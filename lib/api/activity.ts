import { api } from "./client";
import type {
  ActivityPage,
  ActivityStatus,
  CancelDownloadsResult,
} from "@/lib/types/activity";

export type ActivityPageParams = {
  view: "queue" | "history";
  status?: ActivityStatus | null;
  /** A cause group's `key`. */
  cause?: string | null;
  offset?: number;
  limit?: number;
  /** Forces Aurral past its 15s server-side cache. */
  refresh?: boolean;
};

/**
 * One page of Aurral's activity, filtered and sorted by the server: newest
 * first, an album's track downloads merged into one row.
 */
export async function getActivityPage({
  view,
  status,
  cause,
  offset,
  limit,
  refresh,
}: ActivityPageParams): Promise<ActivityPage> {
  const r = await api.get<ActivityPage>("/requests/page", {
    params: {
      view,
      status: status ?? undefined,
      cause: cause ?? undefined,
      offset,
      limit,
      refresh: refresh ? "1" : undefined,
    },
  });
  return r.data;
}

/**
 * Cancels every queued download the user may cancel, or only one cause
 * group's.
 */
export async function cancelQueuedDownloads(
  cause: string | null,
): Promise<CancelDownloadsResult> {
  const r = await api.post<CancelDownloadsResult>(
    "/playlists/jobs/cancel",
    undefined,
    { params: { cause: cause ?? undefined } },
  );
  return r.data;
}
