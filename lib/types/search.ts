export type SearchArtist = {
  id: string;
  name: string;
  'sort-name': string;
  image: string | null;
  imageUrl: string | null;
  listeners: null;
};

export type SearchArtistsResponse = {
  artists: SearchArtist[];
  count: number;
  offset: number;
};

export type SimilarArtist = {
  id: string;
  name: string;
  image: string | null;
  match: number;
};

export type SimilarArtistsResponse = {
  artists: SimilarArtist[];
};

export type MonitorOption =
  | 'none'
  | 'all'
  | 'existing'
  | 'latest'
  | 'first'
  | 'missing'
  | 'future';

export type AddArtistRequest = {
  foreignArtistId: string;
  artistName: string;
  quality?: string;
  monitorOption?: MonitorOption;
};

export type AddArtistResponse = {
  queued: boolean;
  foreignArtistId: string;
  artistName: string;
  artist?: {
    id: string;
    mbid: string;
    foreignArtistId: string;
    artistName: string;
    monitored: boolean;
    monitorOption: string;
    statistics: {
      albumCount: number;
      trackCount: number;
      sizeOnDisk: number;
    };
  };
};
