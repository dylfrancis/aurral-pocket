import { lastPlayedTrackIds, yourRadio } from "@/hooks/discover/use-your-radio";
import { flowStatusQueryOptions } from "@/hooks/flow/use-flow-status";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import {
  readShuffleSongs,
  songListContext,
} from "@/hooks/library/use-play-library-songs";
import {
  OFFLINE,
  SAVED_SONGS,
  offlineQueue,
} from "@/hooks/offline/use-play-saved-songs";
import { cachedAlbumCover } from "@/hooks/player/queue-covers";
import {
  startQueue,
  type StartQueueOptions,
} from "@/hooks/player/use-start-queue";
import { sortByDisc } from "@/lib/album-discs";
import { ApiError } from "@/lib/api/client";
import { getPlaylistJobs } from "@/lib/api/flow";
import {
  getArtistQueue,
  getCanonicalAlbumTracks,
  getCanonicalGenres,
} from "@/lib/api/library";
import { searchLibrary } from "@/lib/api/search";
import { isOffline, networkKnown } from "@/lib/offline/network";
import {
  canPlayNow,
  savedStatuses,
  type SavedAlbum,
  type SavedPlaylist,
  type SavedSong,
  type SaveStatus,
} from "@/lib/offline/saved-library";
import {
  hasQueue,
  isPlaybackActive,
  playAlbumFromTrack,
  playQueueFrom,
  restoreSavedQueue,
  setShuffle,
  startRadio,
  togglePlayback,
} from "@/lib/player/player";
import {
  hasRadioSeed,
  radioSeedFor,
  type RadioStation,
} from "@/lib/player/radio";
import { toPlayableTrack } from "@/lib/player/saved-queue";
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
import { libraryKeys } from "@/lib/query-keys";
import {
  bestMatch,
  pickSavedFirst,
  siriAsk,
  type SiriCandidate,
  type SiriKind,
  type SiriMatch,
  type SiriQuery,
} from "@/lib/siri/match";
import { headlessSession } from "@/lib/headless-session";
import type { FlowJob } from "@/lib/types/flow";
import type { AlbumTrack, Track } from "@/lib/types/library";
import type {
  LibrarySearchAlbum,
  LibrarySearchArtist,
  LibrarySearchTrack,
} from "@/lib/types/search";
import type {
  SiriFindAnswer,
  SiriItem,
  SiriPlayAnswer,
  SiriPlayRequest,
  SiriSearch,
} from "@/modules/siri";

export type SiriPlayable =
  | { from: "savedAlbum"; item: SavedAlbum }
  | { from: "savedPlaylist"; item: SavedPlaylist }
  | { from: "savedSong"; item: SavedSong }
  | { from: "album"; album: LibrarySearchAlbum }
  | { from: "song"; track: LibrarySearchTrack }
  | { from: "artist"; artist: LibrarySearchArtist }
  | { from: "playlist"; collection: PlaybackCollection }
  | { from: "genre"; genre: string }
  | { from: "anything" };

/**
 * Siri asks for a found item again when it plays it. A few are kept, since
 * Siri can also play one it found a moment earlier.
 */
const KEPT_ITEMS = 20;
const found = new Map<string, Found & { userId: number }>();

/** A found item, and whether Siri asked for its station. */
type Found = { playable: SiriPlayable; radio: boolean };

/** What a station can start from, as on their pages. */
const STATION_KINDS: SiriKind[] = ["artist", "album", "song"];
let foundCount = 0;
/**
 * Siri keeps the items it played, ids and all, past this run. A new run's ids
 * must not reuse them.
 */
const RUN_ID = Math.random().toString(36).slice(2, 8);

/**
 * What Siri heard, matched against the music saved on the phone and then the
 * Library. Never throws: Siri gets an answer it can say.
 */
export async function findForSiri(search: SiriSearch): Promise<SiriFindAnswer> {
  try {
    const ask = siriAsk(search);
    if (ask.ask === "unsupported") return { status: "unsupportedType" };
    const session = await headlessSession();
    if (!session) return { status: "signedOut" };
    const { userId } = session;
    if (ask.ask === "anything") {
      return foundItem(
        { title: null, type: ask.radio ? "station" : "music" },
        { playable: { from: "anything" }, radio: ask.radio },
        userId,
      );
    }

    const { radio } = ask.query;
    const saved = bestMatch(ask.query, savedCandidates(await savedStatuses()));
    if (saved?.hasEveryWord) return foundMatch(saved, radio, userId);

    await networkKnown();
    const library = isOffline() ? null : await libraryMatch(ask.query);
    const pick = pickSavedFirst(saved, library?.match ?? null);
    if (pick) return foundMatch(pick, radio, userId);
    if (library?.sessionLost) return { status: "signedOut" };
    return isOffline() || library?.unreachable
      ? { status: "unavailable" }
      : { status: "notFound" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Play an item findForSiri found. */
export async function playForSiri(
  request: Omit<SiriPlayRequest, "id" | "type">,
): Promise<SiriPlayAnswer> {
  try {
    const item = await foundFor(request);
    return item && (await play(item, request.shuffle ?? false))
      ? { status: "playing" }
      : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

/**
 * The item as found, or found again by what it's called: Siri also plays
 * items it kept from an earlier run, and from an account signed out since.
 */
async function foundFor(
  request: Omit<SiriPlayRequest, "id" | "type">,
): Promise<Found | null> {
  const session = await headlessSession();
  if (!session) return null;
  const kept = found.get(request.itemId);
  if (kept?.userId === session.userId) return kept;
  if (!request.title) {
    const radio = request.itemType === "station";
    return radio || request.itemType === "music"
      ? { playable: { from: "anything" }, radio }
      : null;
  }
  const again = await findForSiri({
    mediaType: request.itemType ?? "unknown",
    name: request.title,
    artist: request.artist,
    genres: [],
    mine: false,
    suggested: [],
  });
  return again.status === "found" ? (found.get(again.item.id) ?? null) : null;
}

/**
 * A playlist or genre has no station, so asked for as radio it plays as
 * itself, and Siri hears so.
 */
function foundMatch(
  match: SiriMatch<SiriPlayable>,
  radio: boolean,
  userId: number,
): SiriFindAnswer {
  const station = radio && STATION_KINDS.includes(match.kind);
  return foundItem(
    station
      ? { title: `${match.title} Radio`, type: "station", artist: null }
      : { title: match.title, type: match.kind, artist: match.artist ?? null },
    { playable: match.value, radio: station },
    userId,
  );
}

function foundItem(
  item: Omit<SiriItem, "id">,
  entry: Found,
  userId: number,
): SiriFindAnswer {
  const id = `aurral:${RUN_ID}:${++foundCount}`;
  found.set(id, { ...entry, userId });
  for (const oldest of found.keys()) {
    if (found.size <= KEPT_ITEMS) break;
    found.delete(oldest);
  }
  return { status: "found", item: { id, ...item } };
}

function savedCandidates(
  saves: readonly SaveStatus[],
): SiriCandidate<SiriPlayable>[] {
  return saves.map(({ item }): SiriCandidate<SiriPlayable> => {
    switch (item.kind) {
      case "album":
        return {
          kind: "album",
          title: item.route.title,
          artist: item.route.artistName,
          value: { from: "savedAlbum", item },
        };
      case "playlist":
        return {
          kind: "playlist",
          title: item.playlist.name,
          value: { from: "savedPlaylist", item },
        };
      case "song":
        return {
          kind: "song",
          title: item.track.title,
          artist: item.track.artist,
          value: { from: "savedSong", item },
        };
    }
  });
}

/**
 * `unreachable` when every read failed, so Siri says Aurral is unavailable
 * rather than that nothing matched. Reads aren't retried: Siri stops waiting
 * after a few seconds.
 */
async function libraryMatch(query: SiriQuery): Promise<{
  match: SiriMatch<SiriPlayable> | null;
  unreachable: boolean;
  sessionLost: boolean;
}> {
  const wants = (kind: SiriCandidate<SiriPlayable>["kind"]) =>
    !query.kinds || query.kinds.includes(kind);
  const reads: Promise<SiriCandidate<SiriPlayable>[]>[] = [];
  if (wants("artist") || wants("album") || wants("song")) {
    for (const text of query.searches) reads.push(searchCandidates(text));
  }
  if (wants("playlist")) reads.push(playlistCandidates());
  if (wants("genre")) reads.push(genreCandidates());

  const results = await Promise.allSettled(reads);
  const candidates = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  return {
    match: bestMatch(query, candidates),
    unreachable: results.every((result) => result.status === "rejected"),
    sessionLost: results.some(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof ApiError &&
        result.reason.status === 401,
    ),
  };
}

async function searchCandidates(
  text: string,
): Promise<SiriCandidate<SiriPlayable>[]> {
  const { artists, albums, tracks } = await searchLibrary(text);
  return [
    ...artists.map((artist): SiriCandidate<SiriPlayable> => ({
      kind: "artist",
      title: artist.name,
      value: { from: "artist", artist },
    })),
    ...albums.map((album): SiriCandidate<SiriPlayable> => ({
      kind: "album",
      title: album.title,
      artist: album.artistName,
      value: { from: "album", album },
    })),
    ...tracks.map((track): SiriCandidate<SiriPlayable> => ({
      kind: "song",
      title: track.title,
      artist: track.artistName,
      value: { from: "song", track },
    })),
  ];
}

/** The account's own playlists and flows. */
async function playlistCandidates(): Promise<SiriCandidate<SiriPlayable>[]> {
  try {
    const status = await queryClient.fetchQuery({
      ...flowStatusQueryOptions(),
      retry: false,
    });
    const collections: PlaybackCollection[] = [
      ...status.staticPlaylists.map((playlist) => ({
        ...playlist,
        kind: "shared" as const,
      })),
      ...status.flows.map((flow) => ({ ...flow, kind: "flow" as const })),
    ];
    return collections.map((collection) => ({
      kind: "playlist",
      title: collection.name,
      value: { from: "playlist", collection },
    }));
  } catch (error) {
    // An account without playlist access has none to match.
    if (error instanceof ApiError && error.status === 403) return [];
    throw error;
  }
}

async function genreCandidates(): Promise<SiriCandidate<SiriPlayable>[]> {
  const genres = await queryClient.fetchQuery({
    queryKey: libraryKeys.genres(),
    queryFn: getCanonicalGenres,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return genres
    .filter((genre) => genre.tracks > 0)
    .map((genre) => ({
      kind: "genre",
      title: genre.name,
      value: { from: "genre", genre: genre.name },
    }));
}

/** True once playback starts. */
async function play({ playable, radio }: Found, shuffle: boolean) {
  // A launch restores the queue before any play, which also clears what the
  // engine kept from the last run. Siri may play first, before any screen.
  await restoreSavedQueue();
  return radio ? playStation(playable, shuffle) : playItem(playable, shuffle);
}

/**
 * The station of what's named, started as its page's Radio starts it.
 * Offline, or with nothing like it in the Library, the thing itself plays.
 */
async function playStation(
  playable: SiriPlayable,
  shuffle: boolean,
): Promise<boolean> {
  try {
    const start = await stationFor(playable);
    if (start) {
      const result = await startRadio(start.station, start.first);
      // A first track plays even when the station comes back empty.
      if (result === "started" || (result === "empty" && start.first)) {
        return true;
      }
    }
  } catch {
    // The station's request failed. The thing itself can still play.
  }
  return playItem(playable, shuffle);
}

async function stationFor(
  playable: SiriPlayable,
): Promise<{ station: RadioStation; first: PlayerTrack | null } | null> {
  switch (playable.from) {
    case "artist": {
      const { artist } = playable;
      // The MBID finds the Library artist, as on the artist page. A name
      // could also match another artist who shares it.
      const mbid = artist.hasMbid ? artist.id : null;
      return {
        station: {
          seed: { artists: [{ id: artist.libraryId, mbid }] },
          label: artist.name,
        },
        first: null,
      };
    }
    case "album":
      return {
        station: {
          seed: { albumIds: [playable.album.libraryId] },
          label: playable.album.title,
        },
        first: null,
      };
    case "savedAlbum": {
      const { item } = playable;
      return {
        station: {
          seed: { albumIds: [item.route.libraryAlbumId || item.id] },
          label: item.route.title,
        },
        first: null,
      };
    }
    case "song": {
      const { track } = playable;
      const context = searchTrackContext(
        track,
        cachedAlbumCover(queryClient, track.albumMbid),
      );
      const first = searchTrackToPlayerTrack(track, context);
      return first && songStation(first, track.title);
    }
    case "savedSong": {
      const first = toPlayableTrack(playable.item.track, SAVED_SONGS);
      return first && songStation(first, playable.item.track.title);
    }
    case "anything": {
      const trackIds = await lastPlayedTrackIds();
      return trackIds.length > 0
        ? { station: yourRadio(trackIds), first: null }
        : null;
    }
    default:
      return null;
  }
}

/** A song's station, as its track sheet starts it: the song plays first. */
function songStation(first: PlayerTrack, label: string) {
  const seed = radioSeedFor([first]);
  return hasRadioSeed(seed) ? { station: { seed, label }, first } : null;
}

/** Plays as the screen for each kind does. True once playback starts. */
async function playItem(
  playable: SiriPlayable,
  shuffle: boolean,
): Promise<boolean> {
  switch (playable.from) {
    case "savedAlbum":
      return playAlbum(
        playable.item.tracks,
        savedAlbumContext(playable.item),
        shuffle,
      );
    case "album": {
      const { album } = playable;
      const tracks = await getCanonicalAlbumTracks(album.libraryId);
      return playAlbum(sortByDisc(tracks), searchAlbumContext(album), shuffle);
    }
    case "savedSong": {
      const item = toPlayableTrack(playable.item.track, SAVED_SONGS);
      return item ? playQueueFrom([item], item.id, SAVED_SONGS) : false;
    }
    case "song": {
      // A song plays alone, as one picked from search does.
      const { track } = playable;
      const context = searchTrackContext(
        track,
        cachedAlbumCover(queryClient, track.albumMbid),
      );
      const item = searchTrackToPlayerTrack(track, context);
      return item ? playQueueFrom([item], item.id, context) : false;
    }
    case "savedPlaylist":
      return playCollection(
        { ...playable.item.playlist, kind: "shared" },
        playable.item.jobs,
        shuffle,
      );
    case "playlist":
      return playCollection(
        playable.collection,
        await getPlaylistJobs(playable.collection.id),
        shuffle,
      );
    case "artist":
      return playArtist(playable.artist, shuffle);
    case "genre":
      return playSongs(
        await readShuffleSongs({ genre: playable.genre }),
        songListContext(playable.genre),
        true,
      );
    case "anything":
      return playAnything();
  }
}

/** The album page's Play and Shuffle. */
async function playAlbum(
  tracks: Track[],
  context: PlayerAlbumContext,
  shuffle: boolean,
): Promise<boolean> {
  const playable = tracks.filter(
    (track) => !!track.streamPath && canPlayNow(track.id),
  );
  const start = shuffle
    ? playable[Math.floor(Math.random() * playable.length)]
    : playable[0];
  if (!start) return false;
  if (shuffle) await setShuffle(true);
  return playAlbumFromTrack(tracks, start, context);
}

function savedAlbumContext(item: SavedAlbum): PlayerAlbumContext {
  return {
    albumTitle: item.route.title,
    artistName: item.route.artistName,
    coverPath: item.route.coverUrl || null,
    artworkUrl: null,
    albumMbid: item.route.albumMbid || null,
    artistMbid: item.route.artistMbid || null,
    albumRef: item.id,
  };
}

function searchAlbumContext(album: LibrarySearchAlbum): PlayerAlbumContext {
  return {
    albumTitle: album.title,
    artistName: album.artistName,
    coverPath: album.coverUrl,
    artworkUrl: null,
    albumMbid: album.id,
    artistMbid: album.artistMbid,
    albumRef: album.libraryId,
  };
}

/** A playlist or flow page's Play and Shuffle. */
async function playCollection(
  collection: PlaybackCollection,
  jobs: FlowJob[],
  shuffle: boolean,
): Promise<boolean> {
  const items = jobs
    .map((job) =>
      jobToPlayerTrack(
        job,
        collection,
        cachedAlbumCover(queryClient, job.albumMbid),
      ),
    )
    .filter(isTrack);
  const result = await startQueue(
    queryClient,
    items,
    collectionPlayerContext(collection),
    siriShuffle(shuffle),
  );
  return result === "started";
}

/** The artist page's Play: every Library song by the artist, album by album. */
async function playArtist(
  artist: LibrarySearchArtist,
  shuffle: boolean,
): Promise<boolean> {
  const tracks = await getArtistQueue(artist.id);
  const items = tracks
    .map((track) => queueTrackToPlayerTrack(track, null))
    .filter(isTrack);
  const context: PlayerAlbumContext = {
    albumTitle: artist.name,
    artistName: artist.name,
    coverPath: null,
    artworkUrl: null,
    albumMbid: null,
    artistMbid: artist.id,
  };
  const result = await startQueue(
    queryClient,
    items,
    context,
    siriShuffle(shuffle),
  );
  return result === "started";
}

async function playSongs(
  songs: readonly AlbumTrack[],
  context: PlayerAlbumContext,
  shuffled: boolean,
): Promise<boolean> {
  const items = songs
    .map((song) => toPlayerTrack(song, albumTrackContext(song, queryClient)))
    .filter(isTrack);
  const result = await startQueue(
    queryClient,
    items,
    context,
    siriShuffle(shuffled),
  );
  return result === "started";
}

/** Siri turns shuffle on when asked to and otherwise leaves it as it is. */
function siriShuffle(shuffle: boolean): StartQueueOptions {
  return shuffle ? { shuffled: true } : {};
}

/**
 * "Siri, play Aurral": the queue, where it stopped. With none, the Library
 * shuffled, or offline, the saved music shuffled, as Offline's Shuffle does.
 */
async function playAnything(): Promise<boolean> {
  if (isPlaybackActive()) return true;
  if (hasQueue()) {
    await togglePlayback();
    return true;
  }
  await networkKnown();
  if (isOffline()) {
    const result = await startQueue(
      queryClient,
      offlineQueue(await savedStatuses()),
      OFFLINE,
      { shuffled: true },
    );
    return result === "started";
  }
  return playSongs(
    await readShuffleSongs({}),
    songListContext("Library"),
    true,
  );
}

function isTrack(item: PlayerTrack | null): item is PlayerTrack {
  return item !== null;
}
