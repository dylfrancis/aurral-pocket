import { api } from "./client";
import type { ActivityItem } from "@/lib/types/activity";

/**
 * The feed merges Lidarr album requests (type: "album") with Aurral's own
 * history entries (type: "activity"). Both are returned as-is; the server has
 * already dropped the kinds it hides and sorted the result.
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

export async function deleteAlbumRequest(albumId: string) {
  const r = await api.delete(`/requests/album/${albumId}`);
  return r.data;
}
