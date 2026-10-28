import { useQuery } from "@tanstack/react-query";
import { getDownloadStatuses } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { Album, DownloadStatusMap } from "@/lib/types/library";

/**
 * Poll Lidarr's download status for the albums Lidarr manages. The map is
 * keyed by Lidarr album id; read it with albumDownloadStatus.
 */
export function useDownloadStatuses(albums: Album[] | undefined) {
  const lidarrAlbums = albums?.filter((a) => a.lidarrId) ?? [];
  const ids = lidarrAlbums.map((a) => a.lidarrId!);
  const hasIncomplete = lidarrAlbums.some(
    (a) => a.statistics.percentOfTracks < 100 && a.statistics.sizeOnDisk === 0,
  );

  return useQuery<DownloadStatusMap>({
    queryKey: libraryKeys.downloadStatuses(ids.join(",")),
    queryFn: () => getDownloadStatuses(ids),
    enabled: ids.length > 0 && hasIncomplete,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}
