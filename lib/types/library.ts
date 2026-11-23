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
/** Where a Library file sits. "all" asks a read for every one. */
export type LibrarySource = "aurral" | "readonly" | "flow" | "all";

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
  /** Canonical read path only. See CanonicalArtistItem. */
  providerId?: string | number | null;
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
  /**
   * Canonical read path only. The disc the track sits on in this album. A
   * track saved offline before discs were read has none.
   */
  discNumber?: number;
  /** Canonical read path only. The file's disc subtitle tag. */
  discTitle?: string | null;
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

/**
 * A Library track ready for the play queue, in the shape Aurral's radio
 * returns. `streamPath` is server-relative and takes the session token.
 */
export type LibraryQueueTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  streamPath: string;
  streamFormat: string | null;
  quality: string | null;
  durationMs: number | null;
  artistMbid: string | null;
  /** The release group's MBID when the album has one, else the release's. */
  albumMbid: string | null;
  trackMbid: string | null;
  libraryTrackId: number;
  libraryAlbumId: number;
  libraryArtistId: number | null;
  /** Server-relative: the track's own artwork, else its album cover. */
  artworkUrl: string | null;
  artworkSource: "track" | "album";
};

export type PreviewTrack = {
  id: string;
  title: string;
  album: string | null;
  /** The album's cover. A server path when only the release group is known. */
  artworkUrl?: string | null;
  /** Null when the server has no artist name to look the clip up by. */
  preview_url: string | null;
  duration_ms: number | null;
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
  sort?: LibrarySort;
  direction?: "asc" | "desc";
  artistId?: string;
  albumId?: string;
  status?: LibraryStatus | null;
  /** Only the signed-in user's favorites. */
  favorite?: boolean;
};

/**
 * The orders GET /library takes. `played` and `plays` keep only what the user
 * has played. `random` shuffles albums only: artists and tracks come back by
 * name. `favorited` orders nothing without `favorite`.
 */
export type LibrarySort =
  | "name"
  | "artist"
  | "newest"
  | "played"
  | "plays"
  | "released"
  | "random"
  | "favorited";

/**
 * The Library's status filter. An artist matches when one of its albums does,
 * and a track matches by its album. An album Aurral manages that isn't out yet
 * isn't missing.
 */
export type LibraryStatus = "monitored" | "unmonitored" | "missing";

/**
 * One view of the Library's artists. Search runs on the phone over the whole
 * list, so it isn't part of the view.
 */
export type LibraryArtistsParams = {
  sort: LibrarySort;
  status: LibraryStatus | null;
  favorite: boolean;
};

/**
 * One view of a list the server pages, searches and sorts. Every field is
 * always set, so equal views share one cache entry.
 */
export type LibraryListParams = LibraryArtistsParams & {
  /** Empty for no search. */
  query: string;
  direction: "asc" | "desc";
};

/** One view of the whole-library album list. */
export type LibraryAlbumsParams = LibraryListParams & {
  /** Empty for every genre. */
  genre: string;
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
  /**
   * Null for an artist Aurral scanned. The web offers Match artist only then.
   */
  providerId?: string | number | null;
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
  /** The file's tags as the scanner read them. A wanted track has none. */
  metadata?: { tags?: { discsubtitle?: string | string[] } } | null;
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

/** A track, with the album its stream path plays from. */
export type AlbumTrack = Track & { album?: Album };

export type FavoriteTrack = AlbumTrack;

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

/** The Favorites screen's sections, each in the order the server sorted it. */
export type FavoriteLists = Pick<
  LibraryFavorites,
  "artists" | "albums" | "tracks"
>;

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
 * A quick scan reads new and changed files, and a full scan reads every file
 * again. An artist's rescan reads only that artist's files.
 */
export type LibraryScanScope =
  { mode: "quick" | "full" } | { artistId: number };

/** A MusicBrainz artist that `GET /library/artists/:id/matches` offers. */
export type ArtistMatch = {
  /** The MBID. */
  id: string;
  name: string;
  disambiguation: string | null;
  type: string | null;
  imageUrl: string | null;
  /** The Library artist that already has this MBID. */
  libraryArtistId: number | null;
};

/** Body of `PUT /library/artists/:id/mbid`. */
export type ArtistMatchResult = {
  /** The Library artist that now holds the files, which a merge changes. */
  id: number;
  mbid: string | null;
  name: string;
  musicbrainzName: string | null;
  /** True when the match moved this artist into one already in the Library. */
  merged: boolean;
};

/**
 * Body of `GET /library/lookup/:mbid`, as far as pocket reads it. The route
 * also returns the artist and its albums.
 */
export type ArtistLibraryLookup = {
  exists: boolean;
  /** Null until the Library indexes the artist. */
  libraryArtistId: string | null;
};

/** Body of `POST /library/lookup/batch`: library membership by artist MBID. */
export type ArtistLookupBatch = Record<string, boolean>;

/**
 * One album of `POST /library/albums/lookup/batch`, as far as pocket reads it.
 * "partial" covers an album that is missing tracks, including one with no
 * files yet.
 */
export type AlbumLibraryLookup = {
  libraryAlbumId: string;
  libraryArtistId: string;
  status: "available" | "partial";
};

/**
 * Body of `POST /library/albums/lookup/batch`, keyed by the MBIDs asked
 * about. An album the Library doesn't have is left out.
 */
export type AlbumLookupBatch = Record<string, AlbumLibraryLookup>;
