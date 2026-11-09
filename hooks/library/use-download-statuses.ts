import { useQuery } from "@tanstack/react-query";
import { hasActiveAurralStatus } from "@/lib/album-status";
import { getDownloadStatuses } from "@/lib/api/library";
import { albumStatusKey } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import type { Album, DownloadStatusMap } from "@/lib/types/library";

const POLL_MS = 15_000;

function isIncomplete(album: Album) {
  return (
    album.statistics.percentOfTracks < 100 && album.statistics.sizeOnDisk === 0
  );
}

/** The map is keyed by albumStatusKey; read it with albumDownloadStatus. */
export function useDownloadStatuses(albums: Album[] | undefined) {
  const incomplete = albums?.filter(isIncomplete) ?? [];
  const aurralKeys = incomplete
    .filter((album) => album.managedBy === "aurral")
    .map(albumStatusKey)
    .filter((key): key is string => !!key);
  const lidarrAlbums = (albums ?? []).filter(
    (album) => album.managedBy !== "aurral" && album.lidarrId,
  );
  const hasIncompleteLidarr = lidarrAlbums.some(isIncomplete);
  const keys = [
    ...(hasIncompleteLidarr
      ? lidarrAlbums.map((album) => album.lidarrId!)
      : []),
    ...aurralKeys,
  ];

  return useQuery<DownloadStatusMap>({
    queryKey: libraryKeys.downloadStatuses(keys.join(",")),
    queryFn: () => getDownloadStatuses(keys),
    enabled: keys.length > 0,
    refetchInterval: (query) =>
      hasIncompleteLidarr || hasActiveAurralStatus(query.state.data)
        ? POLL_MS
        : false,
    refetchIntervalInBackground: false,
  });
}
