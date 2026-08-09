import { deleteAlbumRequest } from "@/lib/api/activity";
import { activityKeys } from "@/lib/query-keys";
import type { AlbumRequest } from "@/lib/types/activity";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteAlbumRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (albumId: string) => deleteAlbumRequest(albumId),
    onMutate: async (albumId) => {
      await queryClient.cancelQueries({ queryKey: activityKeys.list() });
      const prev = queryClient.getQueryData<AlbumRequest[]>(
        activityKeys.list(),
      );
      queryClient.setQueryData<AlbumRequest[]>(activityKeys.list(), (old) =>
        old ? old.filter((r) => String(r.albumId) !== String(albumId)) : old,
      );
      return { prev };
    },
    onError: (_err, _albumId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(activityKeys.list(), context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.list() });
    },
  });
}
