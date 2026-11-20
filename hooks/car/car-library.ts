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
import type { Album, Artist, CanonicalPageParams } from "@/lib/types/library";

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
  /** Sorted by title, so it can jump by letter. */
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

/** Long lists stop here: the car shows only so many rows. */
const MAX_ROWS = 200;
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

/** Forget what rows handed on, such as when another account signs in. */
export function forgetCarLists(): void {
  seenTitles.clear();
  seenAlbums.clear();
  seenArtists.clear();
  seenCollections.clear();
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
      return albumsList(
        "Albums",
        { sort: "name", availableOnly: true },
        MAX_ROWS,
      );
    case CAR_LISTS.recentlyPlayed:
      return albumsList(
        "Recently Played",
        // The server reads `asc` as most recent first.
        { sort: "played", direction: "asc" },
        RECENTLY_PLAYED_COUNT,
      );
    case CAR_LISTS.madeForYou:
      return madeForYouList();
  }
  const [kind, ...rest] = id.split(":");
  const ref = rest.join(":");
  switch (kind) {
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

/** Artists with music to play, by name. */
async function artistsList(): Promise<CarList> {
  const artists = await readPages(
    { kind: "artists", source: "all", sort: "name", availableOnly: true },
    MAX_ROWS,
    (page) => page.artists,
  );
  return {
    title: "Artists",
    alphabetical: true,
    rows: artists.map((artist) => {
      const id = `artist:${artist.canonicalId ?? artist.id}`;
      seenArtists.set(id, artist);
      return listRow(
        id,
        artist.artistName,
        authenticatedImageUrl(artist.coverUrl),
      );
    }),
    emptyTitle: "No artists",
  };
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

async function albumsList(
  title: string,
  params: Pick<CanonicalPageParams, "sort" | "direction" | "availableOnly">,
  limit: number,
): Promise<CarList> {
  const albums = await readPages(
    { kind: "albums", source: "all", ...params },
    limit,
    (page) => page.albums,
  );
  return {
    title,
    rows: albums.flatMap(albumRow),
    alphabetical: params.sort === "name",
    emptyTitle: "No albums",
  };
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

async function readPages<T>(
  params: CanonicalPageParams,
  limit: number,
  pick: (page: Awaited<ReturnType<typeof getCanonicalLibraryPage>>) => T[],
): Promise<T[]> {
  const items: T[] = [];
  for (let pageNumber = 1; items.length < limit; pageNumber++) {
    const page = await getCanonicalLibraryPage({
      ...params,
      page: pageNumber,
      pageSize: Math.min(100, limit),
    });
    items.push(...pick(page));
    if (!page.hasMore) break;
  }
  return items.slice(0, limit);
}

function isTrack(item: PlayerTrack | null): item is PlayerTrack {
  return item !== null;
}
