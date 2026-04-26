export type MixPercent = {
  discover: number;
  mix: number;
  trending: number;
};

export type FocusStrength = "light" | "medium" | "heavy";

export type Flow = {
  id: string;
  name: string;
  enabled: boolean;
  size: number;
  mix: MixPercent;
  deepDive: boolean;
  recipe?: string | null;
  tags: Record<string, FocusStrength>;
  relatedArtists: Record<string, FocusStrength>;
  scheduleDays: number[];
  scheduleTime: string;
  nextRunAt: number | null;
};

export type SharedPlaylistTrack = {
  artistName: string;
  trackName: string;
  albumName?: string | null;
  artistMbid?: string | null;
  reason?: string | null;
};

export type SharedPlaylist = {
  id: string;
  name: string;
  sourceName: string | null;
  sourceFlowId: string | null;
  trackCount: number;
  tracks?: SharedPlaylistTrack[];
};

export type FlowJobStatus = "pending" | "downloading" | "done" | "failed";

export type FlowJob = {
  id: string;
  playlistType: string;
  artistName: string;
  trackName: string;
  albumName: string | null;
  artistMbid: string | null;
  status: FlowJobStatus;
  finalPath?: string | null;
  reason?: string | null;
  createdAt?: number;
};

export type PlaylistStats = {
  total: number;
  pending: number;
  downloading: number;
  done: number;
  failed: number;
};

export type StatusHintPhase =
  | "idle"
  | "preparing"
  | "downloading"
  | "queued"
  | "completed";

export type StatusHint = {
  phase: StatusHintPhase;
  message: string;
};

export type WorkerStatus = {
  running: boolean;
  processing: boolean;
  stats: PlaylistStats;
};

export type SoulseekStatus = {
  configured: boolean;
  connected: boolean;
};

export type OperationQueueStatus = {
  processing: boolean;
  currentLabel: string | null;
};

export type FlowStatusSnapshot = {
  worker: WorkerStatus;
  soulseek: SoulseekStatus;
  stats: PlaylistStats;
  flowStats: Record<string, PlaylistStats>;
  sharedStats: PlaylistStats;
  sharedPlaylistStats: Record<string, PlaylistStats>;
  jobs?: FlowJob[];
  flows: Flow[];
  sharedPlaylists: SharedPlaylist[];
  retryCyclePausedByPlaylist: Record<string, boolean>;
  retryCycleScheduledByPlaylist: Record<string, boolean>;
  operationQueue: OperationQueueStatus;
  hint: StatusHint;
};

export type WorkerSettings = {
  concurrency: 1 | 2 | 3;
  preferredFormat: "flac" | "mp3";
  preferredFormatStrict: boolean;
  retryCycleMinutes: 15 | 30 | 60 | 360 | 720 | 1440;
};

export type FlowFormValues = {
  name: string;
  size: number;
  mix: MixPercent;
  deepDive: boolean;
  tags: Record<string, FocusStrength>;
  relatedArtists: Record<string, FocusStrength>;
  scheduleDays: number[];
  scheduleTime: string;
};

export const DEFAULT_MIX: MixPercent = {
  discover: 50,
  mix: 30,
  trending: 20,
};

export const DEFAULT_FLOW_SIZE = 30;

export const DEFAULT_FLOW_FORM: FlowFormValues = {
  name: "Discover",
  size: DEFAULT_FLOW_SIZE,
  mix: DEFAULT_MIX,
  deepDive: false,
  tags: {},
  relatedArtists: {},
  scheduleDays: [],
  scheduleTime: "00:00",
};

export const FOCUS_STRENGTHS: Record<FocusStrength, number> = {
  light: 20,
  medium: 35,
  heavy: 50,
};

export const MIX_PRESETS: { id: string; label: string; mix: MixPercent }[] = [
  {
    id: "balanced",
    label: "Balanced",
    mix: { discover: 50, mix: 30, trending: 20 },
  },
  {
    id: "discover",
    label: "Discover",
    mix: { discover: 70, mix: 20, trending: 10 },
  },
  {
    id: "library",
    label: "Library",
    mix: { discover: 25, mix: 65, trending: 10 },
  },
  {
    id: "trending",
    label: "Trending",
    mix: { discover: 35, mix: 20, trending: 45 },
  },
];

export const RETRY_CYCLE_OPTIONS_MINUTES = [
  15, 30, 60, 360, 720, 1440,
] as const;

export const FLOW_SIZE_MIN = 10;
export const FLOW_SIZE_MAX = 100;
export const FLOW_SIZE_STEP = 5;
