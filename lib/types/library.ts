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

/**
 * Which database the server reads from. The default (legacy) path reads from
 * Lidarr. The canonical path reads from the canonical library, a dedicated
 * database of owned artists, albums, and tracks. The server added it in 2.5.0.
 */
export type LibraryReadPath = "canonical";

/** Which scanner owns the records. Canonical read path only. */
export type LibrarySource = "aurral" | "lidarr" | "all";

export type LibraryReadOptions = {
  readPath?: LibraryReadPath;
  source?: LibrarySource;
};

export type Artist = {
  id: string;
  mbid: string;
  foreignArtistId: string;
  artistName: string;
  monitored: boolean;
  monitorOption: string;
  /**
   * Null on the canonical read path. The canonical library does not record an
   * added date, so screens must not assume a parseable value here.
   */
  addedAt: string | null;
  statistics: ArtistStatistics;
  /** Canonical read path only. The artist id in the canonical library. */
  canonicalId?: string;
  /** Canonical read path only. The scanners that found this artist. */
  sources?: LibrarySource[];
  /** Canonical read path only. True when at least one file exists. */
  available?: boolean;
};

export type AlbumStatistics = {
  trackCount: number;
  sizeOnDisk: number;
  percentOfTracks: number;
  /** Canonical read path only. The number of tracks that have a file. */
  trackFileCount?: number;
};

export type PrimaryReleaseType =
  "Album" | "EP" | "Single" | "Broadcast" | "Other";

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
  /** Canonical read path only. The scanners that found this album. */
  sources?: LibrarySource[];
  /** Canonical read path only. True when at least one track has a file. */
  available?: boolean;
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
   * Canonical read path only. The server route that streams the file. Null
   * when no file exists. The canonical response carries this in place of the
   * filesystem path, which the server strips.
   */
  streamPath?: string | null;
  /** Canonical read path only. The container format of the file. */
  streamFormat?: string | null;
  /** Canonical read path only. The scanners that found this track. */
  sources?: LibrarySource[];
  /** Canonical read path only. True when a readable file exists. */
  available?: boolean;
};

export type PreviewTrack = {
  id: string;
  title: string;
  album: string | null;
  preview_url: string;
  duration_ms: number;
};

export type DownloadStatusValue =
  | "adding"
  | "searching"
  | "downloading"
  | "moving"
  | "processing"
  | "failed"
  | "added"
  | "available";

export type DownloadStatusEntry = {
  status: DownloadStatusValue;
};

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

// The canonical metadata bags below are declared partially, by design. A
// Lidarr-managed artist or album stores the whole Lidarr payload; a
// file-scanned entity stores `{ tags }` read from its file. Only the keys
// pocket or the server reads are declared — an undeclared key still arrives
// on the wire, it just cannot be read without widening the type here.

/** File tags as the scanner stored them (music-metadata's common tags). */
export type CanonicalFileTags = {
  title?: string;
  artist?: string;
  album?: string;
  albumartist?: string;
  date?: string;
  releasedate?: string;
};

/** One provider image inside stored metadata; the server reads the URLs. */
export type CanonicalMetadataImage = {
  url?: string;
  remoteUrl?: string;
  imageUrl?: string;
  coverType?: string;
};

export type CanonicalArtistMetadata = {
  foreignArtistId?: string;
  monitored?: boolean;
  monitor?: string;
  added?: string;
  librarySource?: "lidarr";
  tags?: CanonicalFileTags;
};

/** The page route derives an album's `coverUrl` from `images`. */
export type CanonicalAlbumMetadata = {
  librarySource?: "lidarr";
  images?: CanonicalMetadataImage[];
  tags?: CanonicalFileTags;
};

/** Lidarr track payloads are stored without a `librarySource` marker. */
export type CanonicalTrackMetadata = {
  tags?: CanonicalFileTags;
};

/**
 * The quality the indexing scanner recorded. The file scanner writes the
 * declared keys; the Lidarr indexer stores Lidarr's mediaInfo object
 * instead, whose keys arrive undeclared.
 */
export type CanonicalMediaQuality = {
  format?: string | null;
  bitrate?: number | null;
  sampleRate?: number | null;
  bitsPerSample?: number | null;
};

/**
 * One artist as GET /library/canonical returns it: the raw canonical library
 * row. Unlike the read adapter behind /library/artists?readPath=canonical,
 * this route does not adapt rows to the legacy shape. getCanonicalLibraryPage
 * maps these to `Artist` before anything else sees them.
 */
export type CanonicalArtistItem = {
  id: number | string;
  identityKey?: string;
  mbid?: string | null;
  name?: string;
  sortName?: string | null;
  metadata?: CanonicalArtistMetadata | null;
  albumCount?: number;
  trackCount?: number;
  sizeOnDisk?: number;
  sources?: LibrarySource[];
  available?: boolean;
  /** Present when the request is authenticated. */
  userFavorite?: boolean;
};

/**
 * One media file on a canonical track. The server strips every key that ends
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
 * One album as GET /library/canonical returns it: the raw canonical library
 * row. It does not match the legacy Album type — map it before treating it as
 * one. `trackCount`, `availableTrackCount`, and `coverUrl` are added by the
 * page route on top of the stored row.
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
  metadata?: CanonicalAlbumMetadata | null;
  trackIds?: (number | string)[];
  sources?: LibrarySource[];
  available?: boolean;
  trackCount?: number;
  availableTrackCount?: number;
  /** An image-proxy URL derived from the metadata images; null without one. */
  coverUrl?: string | null;
  /** Present when the request is authenticated. */
  userFavorite?: boolean;
};

/**
 * One track as GET /library/canonical returns it: the raw canonical library
 * row. It does not match the legacy Track type — map it before treating it as
 * one. A track can appear on several albums; `albums` carries its position on
 * each.
 */
export type CanonicalTrackItem = {
  id: number | string;
  identityKey?: string;
  mbid?: string | null;
  title?: string;
  artistName?: string;
  metadata?: CanonicalTrackMetadata | null;
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
 * A canonical page after getCanonicalLibraryPage mapped it. `artists` carries
 * the legacy shape the screens read. `albums` and `tracks` are still the raw
 * canonical rows — no caller reads them yet, so nothing maps them.
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
  albums: CanonicalAlbumItem[];
  tracks: CanonicalTrackItem[];
  genres?: CanonicalGenre[];
};

export type LibraryScanStatus = {
  status: "queued" | "running" | "completed" | "failed" | "unknown";
  jobId?: string;
} & Record<string, unknown>;

export type LibraryScanJob = {
  queued: boolean;
  jobId: string;
  status: LibraryScanStatus;
};
