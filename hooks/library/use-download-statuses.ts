import { useQuery } from "@tanstack/react-query";
import { getDownloadStatuses } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { Album, DownloadStatusMap } from "@/lib/types/library";

export function useDownloadStatuses(albums: Album[] | undefined) {
  const ids = albums?.map((a) => a.id).filter(Boolean) ?? [];
  const hasIncomplete = albums?.some(
    (a) => a.statistics.percentOfTracks < 100 && a.statistics.sizeOnDisk === 0,
  );

  return useQuery<DownloadStatusMap>({
    queryKey: libraryKeys.downloadStatuses(ids.join(",")),
    queryFn: () => getDownloadStatuses(ids),
    enabled: ids.length > 0 && !!hasIncomplete,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}
