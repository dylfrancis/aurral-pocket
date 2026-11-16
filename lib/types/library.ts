export type CoverArtType = "artist" | "album";

export type ArtistTag = {
  name: string;
  count: number;
};

export type ArtistStatistics = {
  albumCount: number;
  trackCount: number;
  sizeOnDisk: number;
};

/** Which scanner owns the records in the canonical library. */
export type LibrarySource = "aurral" | "lidarr" | "all";

export type Artist = {
  id: string;
  mbid: string;
  foreignArtistId: string;
  artistName: string;
  monitored: boolean;
  /** Null on the canonical read path, whose rows carry no added date. */
  addedAt: string | null;
  statistics: ArtistStatistics;
  /** Canonical read path only. The artist id in the canonical library. */
  canonicalId?: string;
  /** Canonical read path only. The scanners that found this artist. */
  sources?: LibrarySource[];
  /** Canonical read path only. True when at least one file exists. */
  available?: boolean;
  /** Canonical read path only. The key the favorites API addresses this artist by. */
  identityKey?: string;
  /** Canonical read path only. True when the signed-in user favorited this artist. */
  userFavorite?: boolean;
  /** Canonical read path only. See CanonicalArtistItem. */
  coverUrl?: string;
};

export type AlbumStatistics = {
  trackCount: number;
  sizeOnDisk: number;
  percentOfTracks: number;
  /** Canonical read path only. The number of tracks that have a file. */
  trackFileCount?: number;
};

export type PrimaryReleaseType =
  "Album" | "EP" | "Single" | "Broadcast" | "Compilation" | "Other";

export type SecondaryReleaseType =
  | "Live"
  | "Remix"
  | "Compilation"
  | "Demo"
  | "Broadcast"
  | "Soundtrack"
  | "Spokenword"
  | "Other";

export type ReleaseGroup = {
  id: string;
  title: string;
  "first-release-date": string | null;
  "primary-type": PrimaryReleaseType;
  "secondary-types": SecondaryReleaseType[];
  /** From ListenBrainz, which has no figure for some releases. */
  listenerCount?: number;
};

/** The fields pocket reads from `GET /artists/:mbid`. */
export type ArtistDetails = {
  tags: ArtistTag[];
  /** Absent when the metadata provider has no overview for the artist. */
  bio?: string;
  "release-groups": ReleaseGroup[];
  /**
   * ListenBrainz hadn't answered within the server's wait, so release dates
   * and listener counts may be missing. A later read fills them in.
   */
  "release-stats-pending": boolean;
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
  albumType?: PrimaryReleaseType;
  secondaryTypes?: SecondaryReleaseType[];
  /** Canonical read path only. The album id in the canonical library. */
  canonicalId?: string;
  /**
   * Canonical read path only. True when Aurral manages the album's downloads
   * and monitoring. Its album routes answer 409 for any other album.
   */
  managed?: boolean;
  /** Canonical read path only. The scanners that found this album. */
  sources?: LibrarySource[];
  /** Canonical read path only. True when at least one track has a file. */
  available?: boolean;
  /** Canonical read path only. The key the favorites API addresses this album by. */
  identityKey?: string;
  /** Canonical read path only. True when the signed-in user favorited this album. */
  userFavorite?: boolean;
  /** Canonical read path only. See CanonicalAlbumItem. */
  coverUrl?: string;
  /** Whole-library album pages and favorites only. The library artist's MBID. */
  artistMbid?: string;
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
  /**
   * Canonical read path only. The server route that streams the file; null
   * when Aurral has no file it can read.
   */
  streamPath?: string | null;
  /** Canonical read path only. The container format of the file. */
  streamFormat?: string | null;
  /**
   * Canonical read path only. The file's average bitrate in kbps, when the
   * scanner recorded one.
   */
  bitrateKbps?: number | null;
  /** Canonical read path only. The scanners that found this track. */
  sources?: LibrarySource[];
  /** Canonical read path only. True when a readable file exists. */
  available?: boolean;
  /** Canonical read path only. The artist credited on the track. */
  artistName?: string;
  /** Canonical read path only. The key the favorites API addresses this track by. */
  identityKey?: string;
  /** Canonical read path only. True when the signed-in user favorited this track. */
  userFavorite?: boolean;
};

export type PreviewTrack = {
  id: string;
  title: string;
  album: string | null;
  preview_url: string;
  duration_ms: number;
};

export type LidarrDownloadStatus =
  | "adding"
  | "searching"
  | "downloading"
  | "moving"
  | "processing"
  | "failed"
  | "added"
  | "available";

/** `unreleased` means Aurral queues nothing until the release date. */
export type AurralAlbumStatus =
  | "complete"
  | "downloading"
  | "queued"
  | "unreleased"
  | "blocked"
  | "cancelled"
  | "failed"
  | "partial"
  | "missing";

export type DownloadStatusValue = LidarrDownloadStatus | AurralAlbumStatus;

export type DownloadStatusEntry = {
  status: DownloadStatusValue;
  releaseDate?: string | null;
};

/**
 * GET /library/downloads/status, keyed by Library album id. Albums Aurral
 * doesn't manage are left out.
 */
export type DownloadStatusMap = Record<string, DownloadStatusEntry>;

export type CoverArtImage = {
  image: string;
  front: boolean;
};

export type CoverArtResponse = {
  images: CoverArtImage[];
};

export type CanonicalPageKind = "artists" | "albums" | "tracks" | "genres";

export type CanonicalGenre = {
  name: string;
  artists: number;
  albums: number;
  tracks: number;
};

export type CanonicalPageParams = {
  kind: CanonicalPageKind;
  source?: LibrarySource;
  /**
   * Tri-state on the wire. `true` returns only playable records; `false`
   * returns wanted (fileless) records too. Omitted follows the server's
   * library view: Aurral 2.9 bound it to the "Show available music only"
   * setting. By 2.12 it is a fixed view that keeps only playable or
   * Aurral-monitored albums and the artists that have one, and only playable
   * tracks. Before 2.9 an omitted value meant `false`.
   *
   * Library home lists omit it, so they match the web app. Reads that must
   * show what is missing (an artist's albums, one album, its tracks) send
   * `false`.
   */
  availableOnly?: boolean;
  page?: number;
  /** Capped at 100 by the server; getCanonicalLibraryPage fills it in when unset. */
  pageSize?: number;
  query?: string;
  genre?: string;
  sort?: string;
  direction?: "asc" | "desc";
  artistId?: string;
  albumId?: string;
};

/**
 * One view of the whole-library album list. Every field is always set, so
 * equal views share one cache entry.
 */
export type LibraryAlbumsParams = {
  /** Empty for every genre. */
  genre: string;
  /** Empty for no search. */
  query: string;
  sort: "name" | "artist" | "newest";
  direction: "asc" | "desc";
};

// The raw rows below declare only the keys pocket reads. The server sends
// more, such as the file tags in `metadata`.

/** The quality the scanner recorded for a file. */
export type CanonicalMediaQuality = {
  format?: string | null;
  bitrate?: number | null;
  sampleRate?: number | null;
  bitsPerSample?: number | null;
};

/**
 * One artist as GET /library returns it: the raw Library row.
 * getCanonicalLibraryPage maps these to `Artist` before anything else sees
 * them.
 */
export type CanonicalArtistItem = {
  id: number | string;
  identityKey?: string;
  mbid?: string | null;
  name?: string;
  sortName?: string | null;
  monitored?: boolean;
  albumCount?: number;
  trackCount?: number;
  sizeOnDisk?: number;
  sources?: LibrarySource[];
  available?: boolean;
  /** Present when the request is authenticated. */
  userFavorite?: boolean;
  /**
   * The server-relative path of the artist's image,
   * `/api/library/artists/:id/cover?v=…`. The server serves the artist photo,
   * or else one of the artist's album covers, and answers 404 when it has
   * neither.
   */
  coverUrl?: string | null;
};

/**
 * One media file on a Library track. The server strips every key that ends
 * in "path" from this route, so a file never carries its filesystem path.
 */
export type CanonicalTrackFile = {
  id: number | string;
  albumId?: number | string | null;
  source?: LibrarySource;
  format?: string | null;
  size?: number | null;
  mtimeMs?: number | null;
  durationMs?: number | null;
  quality?: CanonicalMediaQuality | null;
  available?: boolean;
};

/**
 * One album as GET /library returns it: the raw Library row. It does not match
 * the legacy Album type — map it before treating it as one. `trackCount`,
 * `availableTrackCount`, and `coverUrl` are added by the page route on top of
 * the stored row.
 */
export type CanonicalAlbumItem = {
  id: number | string;
  identityKey?: string;
  mbid?: string | null;
  releaseGroupMbid?: string | null;
  artistId?: number | string;
  title?: string;
  albumArtist?: string | null;
  releaseDate?: string | null;
  monitored?: boolean;
  trackIds?: (number | string)[];
  sources?: LibrarySource[];
  available?: boolean;
  trackCount?: number;
  availableTrackCount?: number;
  /** True when Aurral manages the album's downloads and monitoring. */
  managed?: boolean;
  /**
   * The server-relative path of the album's cover: custom artwork when set,
   * otherwise `/api/library/albums/:id/cover?v=…`, which answers 404 when the
   * server has no artwork. Set on every row.
   */
  coverUrl?: string | null;
  /** Present when the request is authenticated. */
  userFavorite?: boolean;
};

/**
 * One track as GET /library returns it: the raw Library row. It does not match
 * the legacy Track type — map it before treating it as one. A track can appear
 * on several albums; `albums` carries its position on each.
 */
export type CanonicalTrackItem = {
  id: number | string;
  identityKey?: string;
  mbid?: string | null;
  title?: string;
  artistName?: string;
  albums?: {
    albumId: number | string;
    discNumber?: number | null;
    trackNumber?: number | null;
  }[];
  files?: CanonicalTrackFile[];
  sources?: LibrarySource[];
  available?: boolean;
  /** Present when the request is authenticated. */
  userFavorite?: boolean;
};

/**
 * GET /library/favorites, as the server sends it. The starred lists carry the
 * ids favoriteEntityId builds. `library` carries raw Library rows for the
 * starred entities, plus the album of each starred track and the artist of
 * each album — the reader must intersect the two. Its rows carry no
 * `userFavorite`.
 */
export type LibraryFavoritesWire = {
  artistIds?: string[];
  albumIds?: string[];
  /**
   * Starred library tracks, and starred flow and playlist downloads under the
   * id they were starred with, matched or not.
   */
  songIds?: string[];
  /** Starred flow and playlist downloads Aurral hasn't matched to a track. */
  playlistSongs?: { id: string }[];
  library?: {
    artists?: CanonicalArtistItem[];
    albums?: CanonicalAlbumItem[];
    tracks?: CanonicalTrackItem[];
  };
};

/** A favorited track, with the album its stream path plays from. */
export type FavoriteTrack = Track & { album?: Album };

/** The user's favorites after getLibraryFavorites mapped and filtered them. */
export type LibraryFavorites = {
  artists: Artist[];
  albums: Album[];
  tracks: FavoriteTrack[];
  /**
   * Starred flow and shared-playlist downloads that Aurral hasn't matched to a
   * library track, by favoriteEntityId. A matched one is in `tracks`.
   */
  playlistSongIds: string[];
};

/**
 * A canonical page after getCanonicalLibraryPage mapped it. Every collection
 * carries the legacy shape the screens read; nothing above the API layer
 * sees a raw canonical row.
 *
 * On album and track pages, `artists` holds the related artists for the page
 * items. The server sends those without counts, so their statistics map to
 * zero.
 */
export type CanonicalPage = {
  kind: CanonicalPageKind;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  genres?: CanonicalGenre[];
};

/** One scan's status as GET /library/refresh/:jobId reports it. */
export type LibraryScanStatus = {
  jobId: number;
  status: "queued" | "running" | "completed" | "failed" | "unknown";
  error: string | null;
};

export type LibraryScanJob = {
  queued: boolean;
  jobId: number;
  status: LibraryScanStatus;
};

/**
 * Body of `GET /library/lookup/:mbid`, as far as pocket reads it. The route
 * also returns the artist and its albums.
 */
export type ArtistLibraryLookup = {
  exists: boolean;
  /** The canonical artist id; null until the canonical library indexes the artist. */
  libraryArtistId: string | null;
};

/** Body of `POST /library/lookup/batch`: library membership by artist MBID. */
export type ArtistLookupBatch = Record<string, boolean>;
