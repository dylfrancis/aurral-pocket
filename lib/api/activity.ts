import { api } from "./client";
import type { ActivityItem } from "@/lib/types/activity";

/**
 * Aurral's history feed, as-is: the server has already dropped the kinds it
 * hides and sorted the result.
 *
 * `refresh` forces Aurral past its 15s server-side cache — use it for an
 * explicit pull-to-refresh, not for background polling.
 */
export async function getActivity(options: { refresh?: boolean } = {}) {
  const r = await api.get<ActivityItem[]>("/requests", {
    params: options.refresh ? { refresh: "true" } : undefined,
  });
  return Array.isArray(r.data) ? r.data : [];
}
