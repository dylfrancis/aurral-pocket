import type { LibraryAlbumsParams } from "@/lib/types/library";

export const playerKeys = {
  coverColor: (imageUri: string) => ["player", "coverColor", imageUri] as const,
};

export const authKeys = {
  me: (serverUrl: string) => ["auth", "me", serverUrl] as const,
  health: (serverUrl: string) => ["auth", "health", serverUrl] as const,
  signedInHealth: (serverUrl: string) =>
    ["auth", "health", serverUrl, "signedIn"] as const,
};

export const libraryKeys = {
  artists: () => ["library", "artists"] as const,
  // Library membership lives under `artists`, so every invalidation of the
  // artist list refreshes it too.
  artistLookups: () => ["library", "artists", "lookup"] as const,
  artistLookup: (mbids: string) =>
    ["library", "artists", "lookup", mbids] as const,
  artistId: (mbid: string) => ["library", "artists", "id", mbid] as const,
  artist: (mbid: string) => ["library", "artist", mbid] as const,
  canonicalArtist: (mbid: string) =>
    ["library", "canonicalArtist", mbid] as const,
  // The prefix of every single-artist read, for invalidation.
  canonicalArtists: () => ["library", "canonicalArtist"] as const,
  albums: (artistId: string) => ["library", "albums", artistId] as const,
  // The prefix of every albumsAll view, for invalidation.
  albumsAllViews: () => ["library", "albumsAll"] as const,
  albumsAll: (params: LibraryAlbumsParams) =>
    ["library", "albumsAll", params] as const,
  album: (albumRef: string) => ["library", "album", albumRef] as const,
  // The prefix of every single-album read, for invalidation.
  albumRecords: () => ["library", "album"] as const,
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
  releaseGroupTracks: (mbid: string) =>
    ["library", "releaseGroupTracks", mbid] as const,
  downloadStatusesAll: () => ["library", "downloadStatuses"] as const,
  downloadStatuses: (artistId: string) =>
    ["library", "downloadStatuses", artistId] as const,
};

export const searchKeys = {
  artists: (query: string) => ["search", "artists", query] as const,
  albums: (query: string) => ["search", "albums", query] as const,
  tagSuggestions: (query: string) => ["search", "tags", query] as const,
  artistsByTag: (tag: string, scope: string) =>
    ["search", "byTag", tag, scope] as const,
  similarArtists: (mbid: string) => ["search", "similar", mbid] as const,
};

export const activityKeys = {
  list: () => ["activity", "list"] as const,
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
  editorialShelf: () => ["discover", "editorial", "shelf"] as const,
  editorialPlaylist: (playlistId: string) =>
    ["discover", "editorial", "playlist", playlistId] as const,
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
  workerSettings: () => ["flow", "worker", "settings"] as const,
  templates: () => ["flow", "templates"] as const,
};

export const meKeys = {
  listeningHistory: () => ["me", "listeningHistory"] as const,
  scrobbleStatus: () => ["me", "scrobbleStatus"] as const,
};
