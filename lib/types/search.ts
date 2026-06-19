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

export type AlbumStatus =
  | "available"
  | "inLibrary"
  | "searching"
  | "downloading"
  | "processing"
  | "missing";

export type SearchAlbum = {
  type: "album";
  id: string;
  title: string;
  artistName: string;
  artistMbid: string | null;
  releaseDate: string | null;
  primaryType: string | null;
  secondaryTypes: string[];
  coverUrl: string | null;
  inLibrary: boolean;
  libraryAlbumId: string | null;
  libraryArtistId: string | null;
  status: AlbumStatus;
};

export type SearchAlbumsResponse = {
  scope: "album";
  query: string;
  count: number;
  offset: number;
  hasMore?: boolean;
  items: SearchAlbum[];
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

export type DiscoverPlaylistType = "flow" | "release_radar" | "focus";

export type DiscoverPlaylistMix = {
  discover: number;
  mix: number;
  trending: number;
  focus: number;
};

export type DiscoverPlaylistRecipe = {
  discover?: number;
  mix?: number;
  trending?: number;
  focus?: number;
  releaseRadar?: number;
};

export type DiscoverPlaylistTrack = {
  artistName: string | null;
  trackName: string | null;
  albumName: string | null;
  artistMbid: string | null;
  albumMbid: string | null;
  trackMbid: string | null;
  releaseYear: number | null;
  reason: string | null;
};

export type DiscoverPlaylist = {
  presetId: string;
  name: string;
  description: string | null;
  type: DiscoverPlaylistType;
  mix: DiscoverPlaylistMix;
  size: number;
  deepDive: boolean;
  tags: string[];
  relatedArtists: string[];
  recipe: DiscoverPlaylistRecipe;
  tracks: DiscoverPlaylistTrack[];
  trackCount: number;
  artworkStyle?: string;
  hasArtwork?: boolean;
  adoptedFlowId: string | null;
  adoptedPlaylistId: string | null;
};

export type DiscoveryResponse = {
  recommendations: DiscoveryArtist[];
  globalTop: DiscoveryArtist[];
  basedOn: BasedOnArtist[];
  topTags: string[];
  topGenres: string[];
  discoverPlaylists?: DiscoverPlaylist[];
  playlistsUpdating?: boolean;
  playlistsUpdateMessage?: string;
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
