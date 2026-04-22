import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { getDownloadStatuses } from "@/lib/api/library";
import { requestsKeys } from "@/lib/query-keys";
import type { DownloadStatusMap } from "@/lib/types/library";
import type { Request } from "@/lib/types/requests";

const ACTIVE_POLL_MS = 15_000;

function isActiveRequest(request: Request): boolean {
  if (!request.albumId) return false;
  if (request.inQueue) return true;
  return request.status !== "available" && request.status !== "failed";
}

export function useRequestsDownloadStatuses(requests: Request[] | undefined) {
  const isFocused = useIsFocused();

  const activeAlbumIds = useMemo(() => {
    if (!requests) return [] as string[];
    return requests
      .filter(isActiveRequest)
      .map((r) => String(r.albumId))
      .sort();
  }, [requests]);

  const idsKey = activeAlbumIds.join(",");
  const enabled = activeAlbumIds.length > 0;

  return useQuery<DownloadStatusMap>({
    queryKey: requestsKeys.downloadStatuses(idsKey),
    queryFn: () => getDownloadStatuses(activeAlbumIds),
    enabled,
    refetchInterval: enabled && isFocused ? ACTIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}
