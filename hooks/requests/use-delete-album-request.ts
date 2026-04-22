import { deleteAlbumRequest } from "@/lib/api/requests";
import { requestsKeys } from "@/lib/query-keys";
import type { Request } from "@/lib/types/requests";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteAlbumRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (albumId: string) => deleteAlbumRequest(albumId),
    onMutate: async (albumId) => {
      await queryClient.cancelQueries({ queryKey: requestsKeys.list() });
      const prev = queryClient.getQueryData<Request[]>(requestsKeys.list());
      queryClient.setQueryData<Request[]>(requestsKeys.list(), (old) =>
        old ? old.filter((r) => String(r.albumId) !== String(albumId)) : old,
      );
      return { prev };
    },
    onError: (_err, _albumId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(requestsKeys.list(), context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: requestsKeys.list() });
    },
  });
}
