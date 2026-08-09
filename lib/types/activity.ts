export type RequestStatus = "processing" | "available" | "failed";

/**
 * Where Aurral sourced an activity entry. Only history items carry this.
 */
export type ActivitySource = "lidarr" | "slskd" | "aurral";

/**
 * A Lidarr-backed album request. Aurral builds these from Lidarr's queue and
 * history rather than its own history table, so they arrive tagged
 * `type: "album"` and never carry a `kind`.
 */
export type AlbumRequest = {
  id: string;
  type: "album";
  albumId: string | null;
  albumMbid: string | null;
  albumName: string;
  artistId: string | null;
  artistMbid: string | null;
  artistName: string;
  status: RequestStatus;
  statusLabel?: string | null;
  requestedAt: string;
  mbid: string | null;
  name: string;
  image: string | null;
  inQueue: boolean;
};

/**
 * Kinds that actually reach a client. Aurral drops `discovery_refresh`,
 * `flow_generating`, `playlist_tracks_added` and `track_reused_aurral` from the
 * feed server-side (ACTIVITY_HIDDEN_KINDS), so they are deliberately absent
 * here. `activity` is the server's fallback for an entry saved without an
 * explicit kind.
 */
export type ActivityKind =
  | "album_requested"
  | "artist_added"
  | "track_download"
  | "track_reused_lidarr"
  | "activity";

/**
 * An entry from Aurral's history feed. The server pre-renders title, subtitle
 * and statusLabel, so Pocket displays them rather than deriving its own copy.
 * `requestedAt` is an ISO string here, matching AlbumRequest.
 */
export type ActivityHistoryItem = {
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
  albumId: string | null;
  requestedBy: { id: number | string; username: string | null } | null;
  sourceFilename: string | null;
  inQueue: boolean;
  canReSearch: boolean;
};

export type ActivityItem = AlbumRequest | ActivityHistoryItem;

export function isAlbumRequest(item: ActivityItem): item is AlbumRequest {
  return item.type === "album";
}

export function isHistoryItem(item: ActivityItem): item is ActivityHistoryItem {
  return item.type === "activity";
}

/**
 * History entries flatten their metadata away, so an artist_added row's MBID
 * survives only inside its href ("/artist/<mbid>"). Returns null for any other
 * shape rather than guessing.
 */
export function historyArtistMbid(item: ActivityHistoryItem): string | null {
  const match = /^\/artist\/([^/?#]+)/.exec(item.href ?? "");
  const mbid = match?.[1]?.trim();
  if (!mbid || mbid === "null" || mbid === "undefined") return null;
  return mbid;
}

/**
 * Both variants expose an ISO requestedAt, so the merged feed sorts on one key.
 */
export function activityTimestamp(item: ActivityItem): number {
  const parsed = new Date(item.requestedAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
