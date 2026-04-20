export type SearchArtist = {
  id: string;
  name: string;
  "sort-name": string;
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

export type TagSuggestionsResponse = {
  tags: string[];
};

export type TagArtist = {
  id: string;
  name: string;
  sortName: string;
  type: string;
  tags: string[];
  image: string | null;
};

export type TagSearchScope = "all" | "recommended";

export type TagArtistsResponse = {
  recommendations: TagArtist[];
  tag: string;
  total: number;
  offset: number;
};

export type MonitorOption =
  | "none"
  | "all"
  | "existing"
  | "latest"
  | "first"
  | "missing"
  | "future";

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

export type DiscoveryArtist = {
  id: string;
  name: string;
  type?: string;
  image?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  sourceArtist?: string;
  sourceType?: string;
  score?: number;
};

export type BasedOnArtist = {
  name: string;
  id?: string;
  source?: string;
};

export type DiscoveryResponse = {
  recommendations: DiscoveryArtist[];
  globalTop: DiscoveryArtist[];
  basedOn: BasedOnArtist[];
  topTags: string[];
  topGenres: string[];
  lastUpdated: string | null;
  isUpdating: boolean;
  stale?: boolean;
  configured: boolean;
};

export type RecentlyAddedArtist = {
  id: string;
  mbid: string;
  foreignArtistId: string;
  artistName: string;
  addedAt: string;
  added?: string;
};

export type RecentlyAddedResponse = RecentlyAddedArtist[];

export type RecentReleaseAlbum = {
  id: string;
  mbid: string;
  foreignAlbumId?: string;
  albumName: string;
  title?: string;
  artistName: string;
  artistId?: string;
  artistMbid?: string;
  foreignArtistId?: string;
  releaseDate: string | null;
};

export type RecentReleasesResponse = RecentReleaseAlbum[];

export type ConcertEvent = {
  id: string;
  artistName: string;
  matchType?: string;
  eventName?: string;
  image?: string | null;
  url?: string | null;
  date?: string | null;
  time?: string | null;
  dateTime?: string | null;
  venueName?: string | null;
  city?: string | null;
  region?: string | null;
  distance?: number;
};

export type NearbyShowsLocation = {
  label?: string | null;
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
  regionCode?: string | null;
  countryCode?: string | null;
};

export type NearbyShowsResponse = {
  configured: boolean;
  location: NearbyShowsLocation | null;
  shows: ConcertEvent[];
  total?: number;
};
