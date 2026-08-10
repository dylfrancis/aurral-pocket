import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { getDownloadStatuses } from "@/lib/api/library";
import { activityKeys } from "@/lib/query-keys";
import type { DownloadStatusMap } from "@/lib/types/library";
import type { ActivityItem } from "@/lib/types/activity";

const ACTIVE_POLL_MS = 15_000;

// Album requests and history entries both expose albumId/inQueue/status, so
// this reads the union without narrowing. History adds "completed" to the set
// of terminal statuses that album requests express as "available".
const SETTLED_STATUSES = new Set(["available", "failed", "completed"]);

function isActiveItem(item: ActivityItem): boolean {
  if (!item.albumId) return false;
  if (item.inQueue) return true;
  return !SETTLED_STATUSES.has(item.status);
}

export function useActivityDownloadStatuses(items: ActivityItem[] | undefined) {
  const isFocused = useIsFocused();

  const activeAlbumIds = useMemo(() => {
    if (!items) return [] as string[];
    return items
      .filter(isActiveItem)
      .map((item) => String(item.albumId))
      .sort();
  }, [items]);

  const idsKey = activeAlbumIds.join(",");
  const enabled = activeAlbumIds.length > 0;

  const query = useQuery<DownloadStatusMap>({
    queryKey: activityKeys.downloadStatuses(idsKey),
    queryFn: () => getDownloadStatuses(activeAlbumIds),
    enabled,
    refetchInterval: enabled && isFocused ? ACTIVE_POLL_MS : false,
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
