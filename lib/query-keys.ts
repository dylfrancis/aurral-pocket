export const authKeys = {
  me: (serverUrl: string) => ['auth', 'me', serverUrl] as const,
};

export const libraryKeys = {
  artists: () => ['library', 'artists'] as const,
  artist: (mbid: string) => ['library', 'artist', mbid] as const,
  albums: (artistId: string) => ['library', 'albums', artistId] as const,
  tracks: (albumId: string) => ['library', 'tracks', albumId] as const,
  artistCover: (mbid: string) => ['cover', 'artist', mbid] as const,
  albumCover: (mbid: string) => ['cover', 'album', mbid] as const,
  releaseGroups: (mbid: string) => ['library', 'releaseGroups', mbid] as const,
};
