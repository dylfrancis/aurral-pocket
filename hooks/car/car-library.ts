import { flowStatusQueryOptions } from "@/hooks/flow/use-flow-status";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import {
  readShuffleSongs,
  songListContext,
} from "@/hooks/library/use-play-library-songs";
import { cachedAlbumCover } from "@/hooks/player/queue-covers";
import {
  startQueue,
  type StartQueueOptions,
} from "@/hooks/player/use-start-queue";
import { headlessSession } from "@/lib/headless-session";
import { sortByDisc } from "@/lib/album-discs";
import { ApiError, authenticatedImageUrl } from "@/lib/api/client";
import { getPlaylistJobs } from "@/lib/api/flow";
import {
  getArtistQueue,
  getCanonicalAlbum,
  getCanonicalAlbumTracks,
  getCanonicalArtist,
  getCanonicalArtistAlbums,
  getCanonicalLibraryPage,
} from "@/lib/api/library";
import {
  getEditorialPlaylist,
  getMadeForYou,
  searchLibrary,
} from "@/lib/api/search";
import {
  editorialContext,
  editorialQueue,
} from "@/lib/discover/editorial-queue";
import {
  collectionPlayerContext,
  jobToPlayerTrack,
  queueTrackToPlayerTrack,
  searchTrackContext,
  searchTrackToPlayerTrack,
  toPlayerTrack,
  type PlaybackCollection,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import { queryClient } from "@/lib/query-client";
import type { BrowseProvider, LibrarySearchTrack } from "@/lib/types/search";
import type {
  Album,
  Artist,
  CanonicalPage,
  CanonicalPageParams,
} from "@/lib/types/library";

/**
 * A row in a car list, the same in CarPlay and Android Auto. Lists are read
 * when the car opens them, by an id that says what to read.
 */
export type CarRow = {
  /** A list's id for a row that opens one, a track id for a song. */
  id: string;
  kind: "list" | "song";
  title: string;
  subtitle?: string;
  image: string | null;
  /** The letter an alphabetical list files the row under. */
  letter?: string;
};

export type CarList = {
  title: string;
  rows: CarRow[];
  songs?: PlayerTrack[];
  /** Plays a song row. Resolves true once playback starts. */
  play?: (trackId: string) => Promise<boolean>;
  /** Shuffles what the list holds, as its page's Shuffle does. */
  shuffle?: () => Promise<boolean>;
  emptyTitle?: string;
  signedOut?: boolean;
  /** Rows run in letter order, so the car can jump by letter. */
  alphabetical?: boolean;
};

export const CAR_LISTS = {
  library: "library",
  playlists: "playlists",
  artists: "artists",
  albums: "albums",
  madeForYou: "made-for-you",
  recentlyPlayed: "recently-played",
} as const;

const SIGN_IN_PROMPT = "Sign in to Aurral on your phone";

/**
 * CarPlay's most rows in a list. An alphabetical list longer than this opens
 * on a row per letter instead.
 */
const MAX_ROWS = 500;
/** The server's largest page. */
const PAGE_SIZE = 100;
/** Pages read at once when a list needs every row. */
const PAGES_AT_ONCE = 6;
/** More would outlast the car's wait for a list. */
const MAX_READ_ROWS = 10_000;
/** As many as the Library's home rail shows. */
const RECENTLY_PLAYED_COUNT = 20;
const SEARCH_LIMIT = 20;

/**
 * Rows hand on what the list they open needs, so it isn't read again. A list
 * opened after a restart, from a row CarPlay kept on screen, reads it.
 */
const seenTitles = new Map<string, string>();
const seenAlbums = new Map<string, Album>();
const seenArtists = new Map<string, Artist>();
const seenCollections = new Map<string, PlaybackCollection>();
/** Every row of an alphabetical list, for the letters it opens on. */
const seenAlphabetical = new Map<string, CarRow[]>();

/** Forget what rows handed on, such as when another account signs in. */
export function forgetCarLists(): void {
  seenTitles.clear();
  seenAlbums.clear();
  seenArtists.clear();
  seenCollections.clear();
  seenAlphabetical.clear();
}

function isSessionLost(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function signedOutList(title: string): CarList {
  return { title, rows: [], emptyTitle: SIGN_IN_PROMPT, signedOut: true };
}

/** Throws when Aurral can't be read; a lost session reads as signed out. */
export async function loadCarList(id: string): Promise<CarList> {
  const session = await headlessSession();
  if (!session) return signedOutList(titleOf(id));
  try {
    return await readList(id);
  } catch (error) {
    if (isSessionLost(error)) return signedOutList(titleOf(id));
    throw error;
  }
}

/** Library songs matching the query; each plays alone, as in Search. */
export async function searchCar(query: string): Promise<CarList> {
  const session = await headlessSession();
  if (!session) return signedOutList(query);
  let tracks: LibrarySearchTrack[];
  try {
    ({ tracks } = await searchLibrary(query, SEARCH_LIMIT));
  } catch (error) {
    if (isSessionLost(error)) return signedOutList(query);
    throw error;
  }
  const songs = tracks.flatMap((track) => {
    const context = searchTrackContext(
      track,
      cachedAlbumCover(queryClient, track.albumMbid),
    );
    const item = searchTrackToPlayerTrack(track, context);
    return item ? [{ item, context }] : [];
  });
  return {
    title: query,
    rows: songs.map(({ item }) => songRow(item)),
    songs: songs.map(({ item }) => item),
    play: async (trackId) => {
      const song = songs.find(({ item }) => item.id === trackId);
      return (
        !!song && (await play([song.item], song.context, { startId: trackId }))
      );
    },
  };
}

function readList(id: string): Promise<CarList> {
  switch (id) {
    case CAR_LISTS.library:
      return Promise.resolve(libraryList());
    case CAR_LISTS.playlists:
      return playlistsList();
    case CAR_LISTS.artists:
      return artistsList();
    case CAR_LISTS.albums:
      return albumsList();
    case CAR_LISTS.recentlyPlayed:
      return recentlyPlayedList();
    case CAR_LISTS.madeForYou:
      return madeForYouList();
  }
  const [kind, ...rest] = id.split(":");
  const ref = rest.join(":");
  switch (kind) {
    case CAR_LISTS.artists:
    case CAR_LISTS.albums:
      return letterList(kind, ref);
    case "artist":
      return artistList(id, ref);
    case "album":
      return albumList(id, ref);
    case "playlist":
      return playlistList(id, ref);
    case "editorial": {
      const [provider, ...playlistId] = rest;
      return madeForYouPlaylist(
        provider as BrowseProvider,
        playlistId.join(":"),
      );
    }
  }
  throw new Error(`No car list "${id}"`);
}

function libraryList(): CarList {
  return {
    title: "Library",
    rows: [
      listRow(CAR_LISTS.playlists, "Playlists"),
      listRow(CAR_LISTS.artists, "Artists"),
      listRow(CAR_LISTS.albums, "Albums"),
    ],
    shuffle: shuffleLibrary,
  };
}

/** Library home's Shuffle Library: songs from random pages of the Library. */
async function shuffleLibrary(): Promise<boolean> {
  const songs = (await readShuffleSongs({}))
    .map((song) => toPlayerTrack(song, albumTrackContext(song, queryClient)))
    .filter(isTrack);
  return play(songs, songListContext("Library"), { shuffled: true });
}

/** The account's own playlists and flows, as Siri finds them. */
async function playlistsList(): Promise<CarList> {
  let collections: PlaybackCollection[];
  try {
    const status = await queryClient.fetchQuery({
      ...flowStatusQueryOptions(),
      retry: false,
    });
    collections = [
      ...status.staticPlaylists.map((playlist) => ({
        ...playlist,
        kind: "shared" as const,
      })),
      ...status.flows.map((flow) => ({ ...flow, kind: "flow" as const })),
    ];
  } catch (error) {
    // An account without playlist access has none.
    if (error instanceof ApiError && error.status === 403) collections = [];
    else throw error;
  }
  return {
    title: "Playlists",
    rows: collections.map((collection) => {
      const id = `playlist:${collection.id}`;
      seenCollections.set(id, collection);
      return listRow(
        id,
        collection.name,
        authenticatedImageUrl(collectionPlayerContext(collection).coverPath),
      );
    }),
    emptyTitle: "No playlists",
  };
}

async function playlistList(id: string, playlistId: string): Promise<CarList> {
  const collection =
    seenCollections.get(id) ?? (await findCollection(playlistId));
  if (!collection) throw new Error(`No playlist ${playlistId}`);
  const jobs = await getPlaylistJobs(collection.id);
  const songs = jobs
    .map((job) =>
      jobToPlayerTrack(
        job,
        collection,
        cachedAlbumCover(queryClient, job.albumMbid),
      ),
    )
    .filter(isTrack);
  return songList(collection.name, songs, collectionPlayerContext(collection));
}

async function findCollection(playlistId: string) {
  await playlistsList();
  return seenCollections.get(`playlist:${playlistId}`) ?? null;
}

/** Artists with music to play, by the name the Library sorts them by. */
async function artistsList(): Promise<CarList> {
  const artists = await readPages(
    { kind: "artists", source: "all", sort: "name", availableOnly: true },
    (page) => page.artists,
  );
  const rows = artists.map((artist) => {
    const id = `artist:${artist.canonicalId ?? artist.id}`;
    seenArtists.set(id, artist);
    return {
      ...listRow(id, artist.artistName, authenticatedImageUrl(artist.coverUrl)),
      letter: letterOf(artist.sortName || artist.artistName),
    };
  });
  return alphabeticalList(CAR_LISTS.artists, rows);
}

/** The artist's albums with music to play, as on their page. */
async function artistList(id: string, artistRef: string): Promise<CarList> {
  const [allAlbums, artist] = await Promise.all([
    getCanonicalArtistAlbums(artistRef),
    seenArtists.get(id) ?? getCanonicalArtist(artistRef),
  ]);
  const albums = allAlbums.filter((album) => album.available !== false);
  return {
    title: titleOf(id) || (artist?.artistName ?? ""),
    rows: albums.flatMap(albumRow),
    // The artist queue is read by MBID, which some artists don't have.
    ...(artist?.mbid ? { shuffle: () => shuffleArtist(artist) } : {}),
    emptyTitle: "No albums",
  };
}

/** The artist page's Shuffle: every Library song by the artist. */
async function shuffleArtist(artist: Artist): Promise<boolean> {
  const songs = (await getArtistQueue(artist.mbid))
    .map((track) => queueTrackToPlayerTrack(track, null))
    .filter(isTrack);
  const context: PlayerAlbumContext = {
    albumTitle: artist.artistName,
    artistName: artist.artistName,
    coverPath: null,
    artworkUrl: null,
    albumMbid: null,
    artistMbid: artist.mbid,
  };
  return play(songs, context, { shuffled: true });
}

/** Albums with music to play, by title. */
async function albumsList(): Promise<CarList> {
  const albums = await readPages(
    { kind: "albums", source: "all", sort: "name", availableOnly: true },
    (page) => page.albums,
  );
  const rows = albums
    .flatMap(albumRow)
    .map((row) => ({ ...row, letter: letterOf(row.title) }));
  return alphabeticalList(CAR_LISTS.albums, rows);
}

async function recentlyPlayedList(): Promise<CarList> {
  const albums = await readPages(
    // The server reads `asc` as most recent first.
    { kind: "albums", source: "all", sort: "played", direction: "asc" },
    (page) => page.albums,
    RECENTLY_PLAYED_COUNT,
  );
  return {
    title: "Recently Played",
    rows: albums.flatMap(albumRow),
    emptyTitle: "No albums",
  };
}

type AlphabeticalId = typeof CAR_LISTS.artists | typeof CAR_LISTS.albums;

const ALPHABETICAL_NAMES: Record<
  AlphabeticalId,
  { title: string; one: string; many: string }
> = {
  [CAR_LISTS.artists]: { title: "Artists", one: "artist", many: "artists" },
  [CAR_LISTS.albums]: { title: "Albums", one: "album", many: "albums" },
};

/**
 * Rows filed by letter, A to Z and then #. A list too long for the car opens
 * on a row per letter, each saying how many rows it holds.
 */
function alphabeticalList(id: AlphabeticalId, rows: CarRow[]): CarList {
  const filed = fileByLetter(rows);
  seenAlphabetical.set(id, filed);
  const { title, one, many } = ALPHABETICAL_NAMES[id];
  const emptyTitle = `No ${many}`;
  if (filed.length <= MAX_ROWS) {
    return { title, rows: filed, alphabetical: true, emptyTitle };
  }
  const counts = new Map<string, number>();
  for (const { letter = "#" } of filed) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return {
    title,
    rows: [...counts].map(([letter, count]) => ({
      ...listRow(`${id}:${letter}`, letter),
      subtitle: `${count} ${count === 1 ? one : many}`,
    })),
    emptyTitle,
  };
}

/** One letter's rows of an alphabetical list, as its letter row opens them. */
async function letterList(
  id: AlphabeticalId,
  letter: string,
): Promise<CarList> {
  // A letter CarPlay kept on screen across a restart reads the list again.
  if (!seenAlphabetical.has(id)) await readList(id);
  const { title, many } = ALPHABETICAL_NAMES[id];
  return {
    title: `${title} · ${letter}`,
    rows: (seenAlphabetical.get(id) ?? []).filter(
      (row) => row.letter === letter,
    ),
    emptyTitle: `No ${many} under ${letter}`,
  };
}

/**
 * Rows grouped by letter in the order they came, once each. The server sorts
 * accented titles after Z, so they move up to their letter.
 */
function fileByLetter(rows: CarRow[]): CarRow[] {
  const byLetter = new Map<string, CarRow[]>();
  const seenIds = new Set<string>();
  for (const row of rows) {
    // A row can move between pages read at once while the Library changes.
    if (seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    const letter = row.letter ?? "#";
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), row]);
  }
  return [...byLetter.keys()]
    .sort((a, b) => Number(a === "#") - Number(b === "#") || (a < b ? -1 : 1))
    .flatMap((letter) => byLetter.get(letter) ?? []);
}

/** Accented letters go under their letter; digits and symbols under #. */
export function letterOf(title: string): string {
  const first = title.trim().normalize("NFD").charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

function albumRow(album: Album): CarRow[] {
  // The paged route matches nothing but the canonical id.
  if (!album.canonicalId) return [];
  const id = `album:${album.canonicalId}`;
  seenAlbums.set(id, album);
  return [
    {
      ...listRow(id, album.title, authenticatedImageUrl(album.coverUrl)),
      subtitle: album.artistName,
    },
  ];
}

async function albumList(id: string, albumId: string): Promise<CarList> {
  const [album, tracks] = await Promise.all([
    seenAlbums.get(id) ?? getCanonicalAlbum(albumId),
    getCanonicalAlbumTracks(albumId),
  ]);
  const context: PlayerAlbumContext = {
    albumTitle: album?.title ?? "",
    artistName: album?.artistName ?? "",
    coverPath: album?.coverUrl || null,
    artworkUrl: cachedAlbumCover(queryClient, album?.mbid || null),
    albumMbid: album?.mbid || null,
    artistMbid: album?.artistMbid || null,
    albumRef: albumId,
  };
  const songs = sortByDisc(tracks)
    .map((track) => toPlayerTrack(track, context))
    .filter(isTrack);
  return songList(album?.title ?? titleOf(id), songs, context);
}

async function madeForYouList(): Promise<CarList> {
  const { discovery, mixes } = await getMadeForYou();
  return {
    title: "Made for You",
    rows: [...discovery, ...mixes].map((playlist) =>
      listRow(
        `editorial:${playlist.provider}:${playlist.id}`,
        playlist.name,
        authenticatedImageUrl(playlist.artworkUrl),
      ),
    ),
    emptyTitle: "Nothing made for you yet",
  };
}

async function madeForYouPlaylist(
  provider: BrowseProvider,
  playlistId: string,
): Promise<CarList> {
  const playlist = await getEditorialPlaylist(provider, playlistId);
  return songList(
    playlist.name,
    editorialQueue(playlist),
    editorialContext(playlist),
  );
}

/** Songs that play as one queue, from the one picked. */
function songList(
  title: string,
  items: PlayerTrack[],
  context: PlayerAlbumContext,
): CarList {
  const songs = items.filter(
    (item, index) => items.findIndex(({ id }) => id === item.id) === index,
  );
  return {
    title,
    rows: songs.map(songRow),
    songs,
    play: (trackId) => play(songs, context, { startId: trackId }),
    shuffle: () => play(songs, context, { shuffled: true }),
    emptyTitle: "No songs to play",
  };
}

async function play(
  songs: PlayerTrack[],
  context: PlayerAlbumContext,
  options: StartQueueOptions,
): Promise<boolean> {
  const result = await startQueue(queryClient, songs, context, options);
  return result === "started";
}

function listRow(
  id: string,
  title: string,
  image: string | null = null,
): CarRow {
  seenTitles.set(id, title);
  return { id, kind: "list", title, image };
}

function songRow(item: PlayerTrack): CarRow {
  return {
    id: item.id,
    kind: "song",
    title: item.title,
    subtitle: item.artist,
    image: authenticatedImageUrl(item.coverPath) ?? item.artwork,
  };
}

function titleOf(id: string): string {
  return seenTitles.get(id) ?? "";
}

/**
 * A Library read in its order, up to `limit` rows. After the first page, the
 * total says how many pages to ask for at once.
 */
async function readPages<T>(
  params: CanonicalPageParams,
  pick: (page: CanonicalPage) => T[],
  limit = MAX_READ_ROWS,
): Promise<T[]> {
  const pageSize = Math.min(PAGE_SIZE, limit);
  const read = (page: number) =>
    getCanonicalLibraryPage({ ...params, page, pageSize }).then((result) => ({
      items: pick(result),
      hasMore: result.hasMore,
    }));
  const first = await getCanonicalLibraryPage({ ...params, page: 1, pageSize });
  const items = pick(first);
  const lastPage = Math.min(
    Math.ceil(first.total / pageSize),
    Math.ceil(limit / pageSize),
  );
  let hasMore = first.hasMore;
  let next = 2;
  while (hasMore && items.length < limit) {
    // A total that came up short still reads on while pages say there's more.
    const last = Math.max(next, Math.min(next + PAGES_AT_ONCE - 1, lastPage));
    const pages = await Promise.all(
      Array.from({ length: last - next + 1 }, (_, index) => read(next + index)),
    );
    for (const page of pages) {
      items.push(...page.items);
      hasMore = page.hasMore;
      if (!hasMore) break;
    }
    next = last + 1;
  }
  return items.slice(0, limit);
}

function isTrack(item: PlayerTrack | null): item is PlayerTrack {
  return item !== null;
}
