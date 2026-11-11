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
  /** The artist's tags that match the listener's top genres. */
  matchedTags: string[];
  sourceArtist: string | null;
  sourceArtists: string[];
  sourceType?: string;
  /** The seed artists that led to this one. */
  supportingSeeds: { artistName?: string }[];
  discoveryTier: string | null;
  /** 1 for a seed's direct neighbour, 2 or more for a neighbour's neighbour. */
  discoveryDepth: number;
  firstDiscoveredAt: string | null;
  score?: number;
};

export type BasedOnArtist = {
  name: string;
  id?: string;
  source?: string;
};

export type EditorialPlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  trackCount: number;
  artworkUrl: string | null;
  curator: string | null;
};

export type EditorialGenre = {
  id: number;
  name: string;
  playlists: EditorialPlaylistSummary[];
};

export type EditorialShelfResponse = {
  forYou: EditorialPlaylistSummary[];
  genres: EditorialGenre[];
};

export type EditorialTrack = {
  artistName: string;
  trackName: string;
  albumName: string | null;
  /** Server-relative. Null when Deezer has no clip for the track. */
  preview_url: string | null;
  artworkUrl: string | null;
  deezerAlbumId: string | null;
};

export type EditorialPlaylist = {
  id: string;
  name: string;
  description: string | null;
  curator: string | null;
  artworkUrl: string | null;
  tracks: EditorialTrack[];
  libraryPlaylistId: string | null;
};

export type EditorialLibraryAddResponse =
  | { playlistId: string; name: string; alreadyAdded: true }
  | {
      playlistId: string;
      name: string;
      alreadyAdded: false;
      tracksQueued: number;
    };

export type EditorialLinks = {
  artistMbid: string | null;
  albumMbid: string | null;
};

/**
 * Places moved since the previous day, positive for up. Null until Aurral has
 * saved two days of the chart.
 */
export type TrendingMovement = number | "new" | null;

export type TrendingSong = EditorialTrack & {
  key: string;
  position: number;
  durationMs: number | null;
  largeArtworkUrl: string | null;
};

export type TrendingChartSong = TrendingSong & {
  movement: TrendingMovement;
};

export type TrendingSpotlight = {
  daysAtTop: number;
  /** Oldest first, one per day for the last 14 days. Null on a day off the chart. */
  ranks: (number | null)[];
};

export type TrendingSongsChart = {
  /** A Deezer playlist id, which the editorial save route takes. */
  playlistId: string;
  playlistName: string;
  libraryPlaylistId: string | null;
  items: TrendingChartSong[];
  spotlight: TrendingSpotlight | null;
};

export type TrendingAlbum = {
  key: string;
  position: number;
  name: string;
  artistName: string;
  artworkUrl: string | null;
  releaseDate: string | null;
  genre: string | null;
};

export type TrendingArtist = {
  key: string;
  position: number;
  name: string;
  imageUrl: string | null;
  mbid: string | null;
  fans: number | null;
};

export type TrendingGenreShare = {
  total: number;
  other: number;
  genres: { name: string; count: number }[];
};

export type TrendingGenre = {
  id: number;
  name: string;
  covers: string[];
  artists: string[];
};

/** Each chart is null, or `genres` empty, until Aurral has loaded it. */
export type TrendingChartsResponse = {
  region: string | null;
  updatedAt: number | null;
  songs: TrendingSongsChart | null;
  albums: TrendingAlbum[] | null;
  genreShare: TrendingGenreShare | null;
  artists: TrendingArtist[] | null;
  genres: TrendingGenre[];
};

export type TrendingGenreChart = {
  id: number;
  name: string;
  region: string;
  updatedAt: number;
  items: TrendingSong[];
};

export type DiscoveryResponse = {
  recommendations: DiscoveryArtist[];
  globalTop: DiscoveryArtist[];
  basedOn: BasedOnArtist[];
  topTags: string[];
  topGenres: string[];
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
