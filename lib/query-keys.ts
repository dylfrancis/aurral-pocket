import type { QueryKey } from "@tanstack/react-query";
import type { SharedPlaylistTrack } from "@/lib/types/flow";
import type {
  LibraryAlbumsParams,
  LibraryArtistsParams,
  LibraryListParams,
  LibrarySort,
} from "@/lib/types/library";
import type { LyricsLookup } from "@/lib/types/lyrics";
import type { BrowseProvider, EditorialShelfScope } from "@/lib/types/search";

export const playerKeys = {
  coverColor: (imageUri: string) => ["player", "coverColor", imageUri] as const,
  lyrics: (lookup: LyricsLookup) => ["player", "lyrics", lookup] as const,
};

export const authKeys = {
  me: (serverUrl: string) => ["auth", "me", serverUrl] as const,
  health: (serverUrl: string) => ["auth", "health", serverUrl] as const,
};

export const libraryKeys = {
  /** The whole artist list, in the server's default order. */
  artists: () => ["library", "artists"] as const,
  /** The artist list filtered, or in an order only the server knows. */
  artistsView: (params: LibraryArtistsParams) =>
    ["library", "artists", params] as const,
  // Library membership lives under `artists`, so every invalidation of the
  // artist list refreshes it too.
  artistLookups: () => ["library", "artists", "lookup"] as const,
  artistLookup: (mbids: string) =>
    ["library", "artists", "lookup", mbids] as const,
  artistId: (mbid: string) => ["library", "artists", "id", mbid] as const,
  artist: (mbid: string) => ["library", "artist", mbid] as const,
  artistMonitoring: (mbid: string) =>
    ["library", "artistMonitoring", mbid] as const,
  monitoringDefaults: () => ["library", "monitoringDefaults"] as const,
  canonicalArtist: (mbid: string) =>
    ["library", "canonicalArtist", mbid] as const,
  // The prefix of every single-artist read, for invalidation.
  canonicalArtists: () => ["library", "canonicalArtist"] as const,
  albums: (artistId: string) => ["library", "albums", artistId] as const,
  // The prefix of every albumsAll view, for invalidation.
  albumsAllViews: () => ["library", "albumsAll"] as const,
  albumsAll: (params: LibraryAlbumsParams) =>
    ["library", "albumsAll", params] as const,
  // Under `albumsAll`, so the Library home's rails reread with its lists.
  albumRail: (sort: LibrarySort) =>
    ["library", "albumsAll", "rail", sort] as const,
  // Album lookups live under `albumsAll`, so every invalidation of the
  // whole-library album list refreshes them too.
  albumLookup: (mbids: string) =>
    ["library", "albumsAll", "lookup", mbids] as const,
  album: (albumRef: string) => ["library", "album", albumRef] as const,
  // The prefix of every single-album read, for invalidation.
  albumRecords: () => ["library", "album"] as const,
  // The prefix of every songs view, for invalidation.
  songViews: () => ["library", "songs"] as const,
  songs: (params: LibraryListParams) => ["library", "songs", params] as const,
  genres: () => ["library", "genres"] as const,
  favorites: () => ["library", "favorites"] as const,
  tracks: (albumId: string) => ["library", "tracks", albumId] as const,
  // The prefix of every album's track list, for invalidation.
  trackLists: () => ["library", "tracks"] as const,
  refresh: (jobId: number) => ["library", "refresh", jobId] as const,
  artistCover: (mbid: string) => ["cover", "artist", mbid] as const,
  albumCover: (mbid: string) => ["cover", "album", mbid] as const,
  artistDetails: (mbid: string) => ["library", "artistDetails", mbid] as const,
  artistPreviews: (mbid: string) =>
    ["library", "artistPreviews", mbid] as const,
  artistQueue: (mbid: string) => ["library", "artistQueue", mbid] as const,
  // A null release is the server's pick: the Library's edition, else the
  // standard one.
  releaseGroupTracks: (mbid: string, release: string | null) =>
    ["library", "releaseGroupTracks", mbid, release] as const,
  // The prefix of every edition's track list of one album, for invalidation.
  releaseGroupTrackLists: (mbid: string) =>
    ["library", "releaseGroupTracks", mbid] as const,
  releaseGroupPreviews: (mbid: string, release: string | null) =>
    ["library", "releaseGroupPreviews", mbid, release] as const,
  releaseGroupPreviewLists: (mbid: string) =>
    ["library", "releaseGroupPreviews", mbid] as const,
  albumEditions: (mbid: string) => ["library", "albumEditions", mbid] as const,
  downloadStatusesAll: () => ["library", "downloadStatuses"] as const,
  downloadStatuses: (artistId: string) =>
    ["library", "downloadStatuses", artistId] as const,
  // Every Add to Library shares this mutation key, so each menu can tell which
  // songs are being sent.
  addTrack: () => ["library", "addTrack"] as const,
};

/**
 * An artist, album or song list narrowed by `filter`: to favorites, or to a
 * status. A change to favorites or monitoring leaves such a list stale.
 */
export function isFilteredListKey(
  queryKey: QueryKey,
  filter: "favorite" | "status",
): boolean {
  const [scope, list, params] = queryKey;
  if (scope !== "library") return false;
  if (list !== "artists" && list !== "albumsAll" && list !== "songs") {
    return false;
  }
  if (typeof params !== "object" || params === null) return false;
  const value = (params as Partial<Record<typeof filter, unknown>>)[filter];
  return filter === "favorite" ? value === true : value != null;
}

const LIBRARY_INDEX_LISTS = new Set([
  "artists",
  "artist",
  "canonicalArtist",
  "albums",
  "albumsAll",
  "album",
  "songs",
  "tracks",
  "genres",
  "favorites",
]);

/**
 * A read of Aurral's Library index, which a scan refreshes. Metadata reads such
 * as artist details, editions and previews stay out, as on the web.
 */
export function isLibraryIndexKey(queryKey: QueryKey): boolean {
  const [scope, list] = queryKey;
  return (
    scope === "library" &&
    typeof list === "string" &&
    LIBRARY_INDEX_LISTS.has(list)
  );
}

export const searchKeys = {
  artists: (query: string) => ["search", "artists", query] as const,
  albums: (query: string) => ["search", "albums", query] as const,
  catalog: (query: string) => ["search", "catalog", query] as const,
  tagSuggestions: (query: string) => ["search", "tags", query] as const,
  artistsByTag: (tag: string, scope: string) =>
    ["search", "byTag", tag, scope] as const,
  similarArtists: (mbid: string) => ["search", "similar", mbid] as const,
  libraryTracks: (query: string) => ["search", "libraryTracks", query] as const,
  librarySearchAll: () => ["search", "librarySearch"] as const,
  librarySearch: (query: string) => ["search", "librarySearch", query] as const,
};

export const shazamKeys = {
  recordings: (isrc: string) => ["shazam", "recordings", isrc] as const,
  link: (url: string) => ["shazam", "link", url] as const,
};

export const activityKeys = {
  feedAll: () => ["activity", "list"] as const,
  pagesAll: () => ["activity", "list", "pages"] as const,
  pages: (filter: {
    view: string;
    status: string | null;
    cause: string | null;
  }) =>
    [
      "activity",
      "list",
      "pages",
      filter.view,
      filter.status,
      filter.cause,
    ] as const,
  counts: () => ["activity", "list", "counts"] as const,
  downloadStatusesAll: () => ["activity", "downloadStatuses"] as const,
  downloadStatuses: (albumIds: string) =>
    ["activity", "downloadStatuses", albumIds] as const,
};

export const discoverKeys = {
  feedback: () => ["discover", "feedback"] as const,
  discovery: () => ["discover", "main"] as const,
  recentlyAdded: () => ["discover", "recentlyAdded"] as const,
  recentReleases: () => ["discover", "recentReleases"] as const,
  nearbyShowsAll: () => ["discover", "nearbyShows"] as const,
  nearbyShows: (zipCode?: string, limit?: number) =>
    ["discover", "nearbyShows", zipCode ?? "", limit ?? null] as const,
  editorialShelf: (scope?: EditorialShelfScope) =>
    ["discover", "editorial", "shelf", scope ?? "all"] as const,
  madeForYou: () => ["discover", "editorial", "made-for-you"] as const,
  editorialPlaylist: (provider: BrowseProvider, playlistId: string) =>
    ["discover", "editorial", "playlist", provider, playlistId] as const,
  editorialLinks: (
    artist: string,
    album?: string | null,
    albumId?: string | null,
  ) => ["discover", "editorial", "links", artist, album, albumId] as const,
  trending: () => ["discover", "trending"] as const,
  trendingGenre: (genreId: string) =>
    ["discover", "trending", "genre", genreId] as const,
};

export const flowKeys = {
  status: () => ["flow", "status"] as const,
  jobsAll: () => ["flow", "jobs"] as const,
  jobs: (playlistId: string) => ["flow", "jobs", playlistId] as const,
  containing: (track: SharedPlaylistTrack) =>
    ["flow", "containing", track] as const,
  workerSettings: () => ["flow", "worker", "settings"] as const,
  templates: () => ["flow", "templates"] as const,
};

export const meKeys = {
  listeningHistory: () => ["me", "listeningHistory"] as const,
  scrobbleStatus: () => ["me", "scrobbleStatus"] as const,
};

export const pluginKeys = {
  actions: () => ["plugins", "actions"] as const,
  // Every run shares this key, so a menu can tell which actions are running.
  run: () => ["plugins", "run"] as const,
};
