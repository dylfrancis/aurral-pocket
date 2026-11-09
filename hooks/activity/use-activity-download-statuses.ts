import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { hasActiveAurralStatus } from "@/lib/album-status";
import { getDownloadStatuses } from "@/lib/api/library";
import { activityKeys } from "@/lib/query-keys";
import type { DownloadStatusMap } from "@/lib/types/library";
import { activityStatusKey, type ActivityItem } from "@/lib/types/activity";

const ACTIVE_POLL_MS = 15_000;

// Album requests and history entries both expose inQueue and status, so this
// reads the union without narrowing.
const SETTLED_STATUSES = new Set([
  "available",
  "failed",
  "completed",
  "cancelled",
]);

function isActiveItem(item: ActivityItem): boolean {
  if (item.inQueue) return true;
  return !SETTLED_STATUSES.has(item.status);
}

/**
 * Aurral marks a request for an album it manages completed at once, so those
 * rows ask for the album's status whatever their own says.
 */
export function useActivityDownloadStatuses(items: ActivityItem[] | undefined) {
  const isFocused = useIsFocused();

  const keys = useMemo(() => {
    const set = new Set<string>();
    for (const item of items ?? []) {
      const key = activityStatusKey(item);
      if (key && (key.startsWith("aurral:") || isActiveItem(item))) {
        set.add(key);
      }
    }
    return [...set].sort();
  }, [items]);

  const enabled = keys.length > 0;
  const hasActiveLidarr = keys.some((key) => !key.startsWith("aurral:"));

  const query = useQuery<DownloadStatusMap>({
    queryKey: activityKeys.downloadStatuses(keys.join(",")),
    queryFn: () => getDownloadStatuses(keys),
    enabled,
    refetchInterval: (current) =>
      enabled &&
      isFocused &&
      (hasActiveLidarr || hasActiveAurralStatus(current.state.data))
        ? ACTIVE_POLL_MS
        : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });

  const { refetch } = query;
  useRefreshOnFocus(
    useCallback(() => {
      // refetch() bypasses `enabled`, so guard it ourselves
      if (enabled) refetch();
    }, [enabled, refetch]),
  );

  return query;
}
