import { useMutation, useQueryClient } from "@tanstack/react-query";
import { triggerAlbumSearch } from "@/lib/api/library";
import { activityKeys } from "@/lib/query-keys";
import type { DownloadStatusMap } from "@/lib/types/library";

export function useResearchAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (albumId: string) => triggerAlbumSearch(albumId),
    onMutate: (albumId) => {
      queryClient.setQueriesData<DownloadStatusMap>(
        { queryKey: activityKeys.downloadStatusesAll() },
        (old) => ({ ...(old ?? {}), [albumId]: { status: "searching" } }),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.list() });
      queryClient.invalidateQueries({
        queryKey: activityKeys.downloadStatusesAll(),
      });
    },
  });
}
