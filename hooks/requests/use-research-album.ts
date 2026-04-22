import { useMutation, useQueryClient } from "@tanstack/react-query";
import { triggerAlbumSearch } from "@/lib/api/library";
import { requestsKeys } from "@/lib/query-keys";
import type { DownloadStatusMap } from "@/lib/types/library";

export function useResearchAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (albumId: string) => triggerAlbumSearch(albumId),
    onMutate: (albumId) => {
      queryClient.setQueriesData<DownloadStatusMap>(
        { queryKey: ["requests", "downloadStatuses"] },
        (old) => ({ ...(old ?? {}), [albumId]: { status: "searching" } }),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: requestsKeys.list() });
      queryClient.invalidateQueries({
        queryKey: ["requests", "downloadStatuses"],
      });
    },
  });
}
