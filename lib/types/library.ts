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
  /** The server caps this at 100. */
  pageSize?: number;
  query?: string;
  genre?: string;
  sort?: string;
  direction?: "asc" | "desc";
  artistId?: string;
  albumId?: string;
};

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

export type LibraryScanStatus = {
  status: "queued" | "running" | "completed" | "failed" | "unknown";
  jobId?: string;
} & Record<string, unknown>;

export type LibraryScanJob = {
  queued: boolean;
  jobId: string;
  status: LibraryScanStatus;
};
