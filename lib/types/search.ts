/**
 * An artist result from the app contract's `GET /search?scope=artist`.
 *
 * `id` is a MusicBrainz ID: every action pocket offers on a result (open the
 * detail screen, add to library) addresses the artist by MBID. The route's
 * `inLibrary` is always false in 2.12.0, so screens mark library artists with
 * useLibraryLookup instead.
 *
 * There is deliberately no artwork field. Aurral's own web UI shows no
 * thumbnails in search results either, and the row fetches none.
 */
export type SearchArtist = {
  id: string;
  name: string;
};

export type SearchArtistsResponse = {
  artists: SearchArtist[];
};

/** Body of `GET /search?scope=artist`, as far as pocket reads it. */
export type SearchArtistsWire = {
  count: number;
  offset: number;
  items: SearchArtist[];
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
  "none" | "all" | "existing" | "latest" | "first" | "missing" | "future";

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

export type DiscoverPlaylistType =
  "flow" | "release_radar" | "focus" | "editorial";

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

/**
 * The server sends two playlist shapes under `discoverPlaylists`. A preset
 * playlist carries the flow fields: `mix`, `size`, `deepDive`, `tags`,
 * `relatedArtists` and `recipe`. An editorial playlist is built from a
 * Last.fm tag chart and omits all six, so each one is optional here.
 */
export type DiscoverPlaylist = {
  presetId: string;
  name: string;
  description: string | null;
  type: DiscoverPlaylistType;
  mix?: DiscoverPlaylistMix;
  size?: number;
  deepDive?: boolean;
  tags?: string[];
  relatedArtists?: string[];
  recipe?: DiscoverPlaylistRecipe;
  tracks: DiscoverPlaylistTrack[];
  trackCount: number;
  /** Editorial playlists only: the chart tag and the editorial sub-type. */
  tag?: string;
  editorialType?: string;
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

export type NearbyShowSource = "library" | "recommended" | "trending";

/**
 * A nearby show, as `/discover/nearby-shows` returns it.
 *
 * One show is one Ticketmaster event, and an event can bill several of the
 * user's artists. `sourceTypes` says why each of them matched.
 */
export type ConcertEvent = {
  id: string;
  artistNames: string[];
  sourceTypes: NearbyShowSource[];
  eventName?: string | null;
  image?: string | null;
  url?: string | null;
  date?: string | null;
  time?: string | null;
  dateTime?: string | null;
  venueName?: string | null;
  city?: string | null;
  region?: string | null;
  distance?: number | null;
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
};
