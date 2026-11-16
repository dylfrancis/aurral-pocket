import { useQuery } from "@tanstack/react-query";
import { hasActiveAurralStatus } from "@/lib/album-status";
import { getDownloadStatuses } from "@/lib/api/library";
import { managedAlbumId } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import type { Album, DownloadStatusMap } from "@/lib/types/library";

const POLL_MS = 15_000;

function isIncomplete(album: Album) {
  return (
    album.statistics.percentOfTracks < 100 && album.statistics.sizeOnDisk === 0
  );
}

/** The map is keyed by Library album id; read it with albumDownloadStatus. */
export function useDownloadStatuses(albums: Album[] | undefined) {
  const albumIds = (albums ?? [])
    .filter(isIncomplete)
    .map((album) => managedAlbumId(album))
    .filter((id): id is string => !!id);

  return useQuery<DownloadStatusMap>({
    queryKey: libraryKeys.downloadStatuses(albumIds.join(",")),
    queryFn: () => getDownloadStatuses(albumIds),
    enabled: albumIds.length > 0,
    refetchInterval: (query) =>
      hasActiveAurralStatus(query.state.data) ? POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}
