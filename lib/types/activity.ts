import { aurralStatusKey } from "@/lib/library-read";

export type RequestStatus = "processing" | "available" | "failed";

/**
 * Where Aurral sourced an activity entry. Only history items carry this. A
 * track download names its download client, or "unknown" when the job never
 * recorded one.
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
  | "share"
  | "unknown";

/** Set when a download replaces a file already in the library. */
export type ActivityUpgrade = { fromQuality: string | null };

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
  | "missing_track_search"
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
  /**
   * Lidarr's album id on a Lidarr request. A request for an album Aurral
   * manages, and a missing-track search, carry the canonical id here.
   */
  albumId: string | null;
  /** Set on requests for albums Aurral manages and on library track downloads. */
  canonicalAlbumId: string | null;
  requestedBy: { id: number | string; username: string | null } | null;
  sourceFilename: string | null;
  upgrade: ActivityUpgrade | null;
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

/** Album requests carry an artist MBID directly, history entries only via their href. */
export function activityArtistMbid(item: ActivityItem): string | null {
  if (!isAlbumRequest(item)) return historyArtistMbid(item);
  const mbid = item.artistMbid;
  if (!mbid || mbid === "null" || mbid === "undefined") return null;
  return mbid;
}

/**
 * Only album requests have a key. A missing-track search also carries a
 * canonical id in `albumId`, which Lidarr would read as some other album.
 */
export function activityStatusKey(item: ActivityItem): string | null {
  if (isAlbumRequest(item)) return item.albumId;
  if (item.kind !== "album_requested") return null;
  const canonicalId = aurralRequestAlbumId(item);
  return canonicalId ? aurralStatusKey(canonicalId) : item.albumId;
}

export function aurralRequestAlbumId(item: ActivityItem): string | null {
  return isHistoryItem(item) && item.kind === "album_requested"
    ? item.canonicalAlbumId
    : null;
}

/**
 * Album downloads file their jobs under the reserved id "library", which is
 * neither a flow nor a playlist.
 */
export function historyPlaylistId(item: ActivityHistoryItem): string | null {
  const id = item.playlistId;
  return id && id !== "library" ? id : null;
}

/**
 * Both variants expose an ISO requestedAt, so the merged feed sorts on one key.
 */
export function activityTimestamp(item: ActivityItem): number {
  const parsed = new Date(item.requestedAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
