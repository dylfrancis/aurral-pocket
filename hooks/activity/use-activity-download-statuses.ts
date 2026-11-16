import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { hasActiveAurralStatus } from "@/lib/album-status";
import { getDownloadStatuses } from "@/lib/api/library";
import { activityKeys } from "@/lib/query-keys";
import type { DownloadStatusMap } from "@/lib/types/library";
import { albumRequestLibraryId, type ActivityItem } from "@/lib/types/activity";

const ACTIVE_POLL_MS = 15_000;

/**
 * Aurral marks a request for an album it manages completed at once, so those
 * rows ask for the album's status whatever their own says.
 */
export function useActivityDownloadStatuses(items: ActivityItem[] | undefined) {
  const isFocused = useIsFocused();

  const albumIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of items ?? []) {
      const albumId = albumRequestLibraryId(item);
      if (albumId) set.add(albumId);
    }
    return [...set].sort();
  }, [items]);

  const enabled = albumIds.length > 0;

  const query = useQuery<DownloadStatusMap>({
    queryKey: activityKeys.downloadStatuses(albumIds.join(",")),
    queryFn: () => getDownloadStatuses(albumIds),
    enabled,
    refetchInterval: (current) =>
      enabled && isFocused && hasActiveAurralStatus(current.state.data)
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
