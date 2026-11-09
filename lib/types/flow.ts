/** In the order of Aurral's `FLOW_SOURCES` (upstream `lib/flows.ts`). */
export const MIX_SOURCES = [
  "discover",
  "mix",
  "trending",
  "focus",
  "newReleases",
] as const;

export type MixSource = (typeof MIX_SOURCES)[number];

export type MixPercent = Record<MixSource, number>;

export type Flow = {
  id: string;
  name: string;
  enabled: boolean;
  size: number;
  mix: MixPercent;
  /** Shown as "Deeper Cuts": tracks ranked 10 to 25 instead of the top 10. */
  deepDive: boolean;
  /** Seeds Focus with the artists the user played most recently. */
  recentListening: boolean;
  /**
   * Whether the flow's plays feed listening history. Optional because Aurral
   * versions before 2.5.0 do not send it. Absent means enabled: the server
   * defaults it with `recordHistory !== false`
   * (`backend/services/weeklyFlow/weeklyFlowPlaylistConfig.js`).
   */
  recordHistory?: boolean;
  /**
   * Inclusive release-year bounds for the tracks this flow picks. Each bound
   * is a 4-digit year, or null when that end of the range is open. Optional
   * because older Aurral versions do not send them.
   */
  yearFrom?: number | null;
  yearTo?: number | null;
  /**
   * Every source keeps only artists that carry one of `tags` and none of
   * `excludeTags`. Focus also searches by `tags`.
   */
  tags: string[];
  excludeTags: string[];
  relatedArtists: string[];
  scheduleDays: number[];
  scheduleTime: string;
  nextRunAt: number | null;
  /** Status snapshot only. See SharedPlaylist. */
  artworkRevision?: number;
};

/**
 * `available` is false while the server can't build the template, as with
 * Listening History before the user has listened to anything.
 */
export type FlowTemplate = {
  id: string;
  name: string;
  description: string;
  available: boolean;
};

export type SharedPlaylistTrack = {
  artistName: string;
  trackName: string;
  albumName?: string | null;
  artistMbid?: string | null;
  albumMbid?: string | null;
  trackMbid?: string | null;
  releaseYear?: string | number | null;
  reason?: string | null;
};

export type SharedPlaylist = {
  id: string;
  name: string;
  sourceName: string | null;
  sourceFlowId: string | null;
  trackCount: number;
  tracks?: SharedPlaylistTrack[];
  recordHistory: boolean;
  /**
   * Dedup keys for the playlist's tracks, from the status snapshot. Compare
   * with buildSharedTrackIdentity to tell whether a track is already in the
   * playlist. Optional because older Aurral versions do not send it.
   */
  trackIdentities?: string[];
  /**
   * Status snapshot only. Changes whenever the server writes new artwork, so
   * it versions the artwork URL. Unset until the playlist first has artwork.
   */
  artworkRevision?: number;
};

export type FlowJobStatus =
  | "pending"
  | "downloading"
  | "cancel_requested"
  | "cancelled"
  | "blocked"
  | "done"
  | "failed";

export type FlowJob = {
  id: string;
  playlistType: string;
  artistName: string;
  trackName: string;
  albumName: string | null;
  artistMbid: string | null;
  albumMbid: string | null;
  trackMbid: string | null;
  /** Artwork uploaded for this track, as a server path. */
  artworkUrl?: string | null;
  status: FlowJobStatus;
  finalPath?: string | null;
  reason?: string | null;
  createdAt?: number;
  /**
   * The file's format family: "flac", "mp3" or "m4a". Empty until the server
   * has checked the download's quality.
   */
  qualityFormat?: string | null;
  qualityBitrateKbps?: number | null;
  /** The downloaded file's extension. */
  streamFormat?: string | null;
};

export type PlaylistStats = {
  total: number;
  pending: number;
  downloading: number;
  /** Absent on Aurral versions that predate the blocked-download review flow. */
  blocked?: number;
  done: number;
  failed: number;
};

export type StatusHintPhase =
  "idle" | "preparing" | "downloading" | "queued" | "completed";

export type StatusHint = {
  phase: StatusHintPhase;
  message: string;
};

export type WorkerStatus = {
  running: boolean;
  processing: boolean;
  stats: PlaylistStats;
};

export type SlskdStatus = {
  configured: boolean;
  connected: boolean;
  downloadPath?: string | null;
  serverState?: string | null;
};

export type OperationQueueStatus = {
  processing: boolean;
  currentLabel: string | null;
};

export type FlowStatusSnapshot = {
  worker: WorkerStatus;
  slskd: SlskdStatus;
  stats: PlaylistStats;
  flowStats: Record<string, PlaylistStats>;
  sharedStats: PlaylistStats;
  sharedPlaylistStats: Record<string, PlaylistStats>;
  flows: Flow[];
  sharedPlaylists: SharedPlaylist[];
  retryCyclePausedByPlaylist: Record<string, boolean>;
  operationQueue: OperationQueueStatus;
  hint: StatusHint;
};

export type ExistingFileMode = "download" | "reuse";

export type WorkerSettings = {
  concurrency: 1 | 2 | 3;
  /**
   * "reuse" matches tracks against existing Aurral/Lidarr files before
   * downloading; "download" always fetches fresh.
   */
  existingFileMode: ExistingFileMode;
};

export type FlowFormValues = {
  name: string;
  size: number;
  mix: MixPercent;
  deepDive: boolean;
  recentListening: boolean;
  recordHistory: boolean;
  yearFrom: number | null;
  yearTo: number | null;
  tags: string[];
  excludeTags: string[];
  relatedArtists: string[];
  scheduleDays: number[];
  scheduleTime: string;
};

export const DEFAULT_MIX: MixPercent = {
  discover: 50,
  mix: 30,
  trending: 20,
  focus: 0,
  newReleases: 0,
};

export const DEFAULT_FLOW_SIZE = 30;

export const createDefaultFlowForm = (): FlowFormValues => ({
  name: "Discover",
  size: DEFAULT_FLOW_SIZE,
  mix: DEFAULT_MIX,
  deepDive: false,
  recentListening: false,
  recordHistory: true,
  yearFrom: null,
  yearTo: null,
  tags: [],
  excludeTags: [],
  relatedArtists: [],
  scheduleDays: [new Date().getDay()],
  scheduleTime: "00:00",
});

export const MIX_PRESETS: { id: string; label: string; mix: MixPercent }[] = [
  {
    id: "balanced",
    label: "Balanced",
    mix: { discover: 50, mix: 30, trending: 20, focus: 0, newReleases: 0 },
  },
  {
    id: "discover",
    label: "Discover",
    mix: { discover: 70, mix: 20, trending: 10, focus: 0, newReleases: 0 },
  },
  {
    id: "library",
    label: "Library",
    mix: { discover: 25, mix: 65, trending: 10, focus: 0, newReleases: 0 },
  },
  {
    id: "trending",
    label: "Trending",
    mix: { discover: 35, mix: 20, trending: 45, focus: 0, newReleases: 0 },
  },
  {
    id: "focused",
    label: "Focused",
    mix: { discover: 30, mix: 20, trending: 10, focus: 40, newReleases: 0 },
  },
];

export const FLOW_SIZE_MIN = 10;
export const FLOW_SIZE_MAX = 100;
export const FLOW_SIZE_STEP = 5;

/**
 * Aurral rejects a year bound outside this range with a 400 error. Keep both
 * ends in step with normalizeYearBound on the server.
 */
export const FLOW_YEAR_MIN = 1000;
export const FLOW_YEAR_MAX = 9999;
