export type CoverArtType = 'artist' | 'album';

export type ArtistStatistics = {
  albumCount: number;
  trackCount: number;
  sizeOnDisk: number;
};

export type Artist = {
  id: string;
  mbid: string;
  foreignArtistId: string;
  artistName: string;
  monitored: boolean;
  monitorOption: string;
  addedAt: string;
  statistics: ArtistStatistics;
};

export type AlbumStatistics = {
  trackCount: number;
  sizeOnDisk: number;
  percentOfTracks: number;
};

export type Album = {
  id: string;
  artistId: string;
  artistName: string;
  mbid: string;
  foreignAlbumId: string;
  albumName: string;
  title: string;
  releaseDate: string | null;
  monitored: boolean;
  statistics: AlbumStatistics;
};

export type Track = {
  id: string;
  mbid: string;
  trackName: string;
  title: string;
  trackNumber: number;
  hasFile: boolean;
  size: number;
  quality: string | null;
};

export type CoverArtImage = {
  image: string;
  front: boolean;
};

export type CoverArtResponse = {
  images: CoverArtImage[];
};
