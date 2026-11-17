/**
 * Where Aurral sourced an activity entry. A track download names its download
 * client, or "unknown" when the job never recorded one or a plugin fetched it.
 */
export type ActivitySource =
  | "lidarr"
  | "aurral"
  | "slskd"
  | "nzbget"
  | "sabnzbd"
  | "tidarr"
  | "ytdlp"
  | "deemix"
  | "qbittorrent"
  | "share"
  | "unknown";

/** Set when a download replaces a file already in the library. */
export type ActivityUpgrade = { fromQuality: string | null };

/**
 * Kinds that actually reach a client. Aurral drops `album_grab`,
 * `discovery_refresh`, `flow_generating`, `playlist_tracks_added` and
 * `track_reused_aurral` from the feed server-side (ACTIVITY_HIDDEN_KINDS), so
 * they are deliberately absent here. `activity` is the server's fallback for
 * an entry saved without an explicit kind. `album_download` is the paged
 * feed's one row for an album's track downloads.
 */
export type ActivityKind =
  | "album_requested"
  | "album_download"
  | "artist_added"
  | "track_download"
  | "missing_track_search"
  | "activity";

export type ActivityCauseKind =
  | "request"
  | "monitoring"
  | "missing"
  | "upgrade"
  | "flow"
  | "playlist"
  | "share";

/**
 * Why Aurral queued a download. `name` is the flow or playlist's, and
 * `syncedFrom` the service a synced playlist comes from.
 */
export type ActivityCause = {
  kind: ActivityCauseKind;
  playlistId: string | null;
  name: string | null;
  syncedFrom: string | null;
};

/**
 * The queued downloads that share a cause. `since` is the earliest request.
 * `subject` names the one artist (monitoring) or album (missing) the group is
 * about, and `subjects` counts them when there are several.
 */
export type ActivityCauseGroup = ActivityCause & {
  key: string;
  count: number;
  since: string;
  subject?: string | null;
  subjects?: number;
};

/**
 * An entry from Aurral's history feed. The server pre-renders title, subtitle
 * and statusLabel, so Pocket displays them rather than deriving its own copy.
 */
export type ActivityItem = {
  id: string;
  type: "activity";
  source: ActivitySource;
  kind: ActivityKind | null;
  title: string;
  subtitle: string | null;
  status: string;
  statusLabel: string | null;
  requestedAt: string;
  href: string | null;
  playlistId: string | null;
  jobId: string | null;
  trackName: string | null;
  artistName: string | null;
  albumName: string | null;
  /**
   * The Library album an album request or a track download belongs to, when
   * the Library has it.
   */
  libraryAlbumId: string | null;
  /**
   * The raw source that fetched a track of an album download: a client id
   * such as "usenet", or "plugin:<id>".
   */
  actualDownloadSource?: string | null;
  requestedBy: { id: number | string; username: string | null } | null;
  sourceFilename: string | null;
  upgrade: ActivityUpgrade | null;
  /** Set on track downloads. */
  cause?: ActivityCause | null;
  inQueue: boolean;
  /** An album download's tracks. */
  children?: ActivityItem[];
  /** An album download's "3 of 10 tracks ready". */
  progressLabel?: string | null;
};

/** The server's status filters. */
export type ActivityStatus =
  | "searching"
  | "downloading"
  | "queued"
  | "review"
  | "downloaded"
  | "upgraded"
  | "failed"
  | "cancelled";

export type ActivityStatusFilter = {
  id: ActivityStatus;
  label: string;
  count: number;
};

/**
 * One page of `GET /requests/page`. `total` counts the view (within `cause`),
 * `matching` what the status filter keeps, and `cancelable` the queued
 * downloads the user may cancel. `causes` is empty outside the queue.
 */
export type ActivityPage = {
  view: "queue" | "history";
  items: ActivityItem[];
  causes: ActivityCauseGroup[];
  cause: string | null;
  total: number;
  matching: number;
  filters: ActivityStatusFilter[];
  cancelable: number;
  paused: boolean;
};

export type CancelDownloadsResult = {
  cancelled: number;
  cleanupFailed: boolean;
};

/**
 * Aurral flattens an entry's metadata away, so an artist_added row's MBID
 * survives only inside its href ("/artist/<mbid>"). Returns null for any other
 * shape rather than guessing.
 */
export function activityArtistMbid(item: ActivityItem): string | null {
  const match = /^\/artist\/([^/?#]+)/.exec(item.href ?? "");
  const mbid = match?.[1]?.trim();
  if (!mbid || mbid === "null" || mbid === "undefined") return null;
  return mbid;
}

/**
 * The Library album id of an album request. It also keys the row in the
 * download status map.
 */
export function albumRequestLibraryId(item: ActivityItem): string | null {
  return item.kind === "album_requested" ? item.libraryAlbumId : null;
}

/**
 * Album downloads file their jobs under the reserved id "library", which is
 * neither a flow nor a playlist.
 */
export function historyPlaylistId(item: ActivityItem): string | null {
  const id = item.playlistId;
  return id && id !== "library" ? id : null;
}
