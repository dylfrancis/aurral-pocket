import { deleteAlbumRequest } from "@/lib/api/activity";
import { activityKeys } from "@/lib/query-keys";
import { isAlbumRequest, type ActivityItem } from "@/lib/types/activity";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteAlbumRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (albumId: string) => deleteAlbumRequest(albumId),
    onMutate: async (albumId) => {
      await queryClient.cancelQueries({ queryKey: activityKeys.list() });
      const prev = queryClient.getQueryData<ActivityItem[]>(
        activityKeys.list(),
      );
      // Only the album request goes; history entries for the same album are a
      // record of what happened and stay in the feed.
      queryClient.setQueryData<ActivityItem[]>(activityKeys.list(), (old) =>
        old
          ? old.filter(
              (item) =>
                !isAlbumRequest(item) ||
                String(item.albumId) !== String(albumId),
            )
          : old,
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
