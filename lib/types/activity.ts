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
 * an entry saved without an explicit kind.
 */
export type ActivityKind =
  | "album_requested"
  | "artist_added"
  | "track_download"
  | "missing_track_search"
  | "activity";

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
  inQueue: boolean;
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
