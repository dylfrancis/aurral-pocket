export const authKeys = {
  me: (serverUrl: string) => ["auth", "me", serverUrl] as const,
};

export const libraryKeys = {
  artists: () => ["library", "artists"] as const,
  artist: (mbid: string) => ["library", "artist", mbid] as const,
  albums: (artistId: string) => ["library", "albums", artistId] as const,
  tracks: (albumId: string) => ["library", "tracks", albumId] as const,
  artistCover: (mbid: string) => ["cover", "artist", mbid] as const,
  albumCover: (mbid: string) => ["cover", "album", mbid] as const,
  artistDetails: (mbid: string) => ["library", "artistDetails", mbid] as const,
  artistPreviews: (mbid: string) =>
    ["library", "artistPreviews", mbid] as const,
  releaseGroupTracks: (mbid: string) =>
    ["library", "releaseGroupTracks", mbid] as const,
  downloadStatuses: (artistId: string) =>
    ["library", "downloadStatuses", artistId] as const,
};

export const searchKeys = {
  artists: (query: string) => ["search", "artists", query] as const,
  tagSuggestions: (query: string) => ["search", "tags", query] as const,
  artistsByTag: (tag: string, scope: string) =>
    ["search", "byTag", tag, scope] as const,
  similarArtists: (mbid: string) => ["search", "similar", mbid] as const,
};

export const requestsKeys = {
  list: () => ["requests", "list"] as const,
  downloadStatuses: (albumIds: string) =>
    ["requests", "downloadStatuses", albumIds] as const,
};

export const discoverKeys = {
  discovery: () => ["discover", "main"] as const,
  recentlyAdded: () => ["discover", "recentlyAdded"] as const,
  recentReleases: () => ["discover", "recentReleases"] as const,
  nearbyShowsAll: () => ["discover", "nearbyShows"] as const,
  nearbyShows: (zipCode?: string, limit?: number) =>
    ["discover", "nearbyShows", zipCode ?? "", limit ?? null] as const,
};
