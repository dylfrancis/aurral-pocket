import type { FlowJobStatus } from "@/lib/types/flow";
import {
  isAlbumRequest,
  type ActivityHistoryItem,
  type ActivityItem,
} from "@/lib/types/activity";

/**
 * A job with no controls gets `null`: it has finished, waits for review, or
 * was saved without being downloaded.
 */
export type TrackJobControls = {
  canStop: boolean;
  /** Retrying a job that is still active stops it first. */
  restarts: boolean;
};

const ACTIVE_STATUSES: ReadonlySet<FlowJobStatus> = new Set([
  "pending",
  "downloading",
  "cancel_requested",
]);

/**
 * Aurral's own sets, except that a job already stopping offers no second
 * Stop.
 */
export function flowJobControls(
  status: FlowJobStatus,
): TrackJobControls | null {
  const active = ACTIVE_STATUSES.has(status);
  if (!active && status !== "failed" && status !== "cancelled") return null;
  return {
    canStop: status === "pending" || status === "downloading",
    restarts: active,
  };
}

export type ActivityJobControls = TrackJobControls & {
  jobId: string;
  trackName: string;
};

export type ActivityJobAccess = {
  userId: number | null;
  hasAccessFlow: boolean;
};

/**
 * The statuses the web offers. The feed reports a downloading or stopping
 * job as "processing", so a stopping one still offers Stop here, which the
 * server accepts. Without accessFlow, Aurral lets a user control only the
 * album-track downloads they requested.
 */
export function activityJobControls(
  item: ActivityItem,
  access: ActivityJobAccess,
): ActivityJobControls | null {
  if (isAlbumRequest(item) || item.kind !== "track_download" || !item.jobId) {
    return null;
  }
  if (!canControl(item, access)) return null;
  const active = item.status === "pending" || item.status === "processing";
  if (!active && item.status !== "failed" && item.status !== "cancelled") {
    return null;
  }
  return {
    jobId: item.jobId,
    trackName: item.trackName ?? item.title,
    canStop: active,
    restarts: active,
  };
}

function canControl(item: ActivityHistoryItem, access: ActivityJobAccess) {
  if (access.hasAccessFlow) return true;
  return (
    item.playlistId === "library" &&
    access.userId != null &&
    item.requestedBy != null &&
    String(item.requestedBy.id) === String(access.userId)
  );
}
