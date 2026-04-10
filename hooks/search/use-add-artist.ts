import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addArtist } from '@/lib/api/search';
import { libraryKeys } from '@/lib/query-keys';
import type { AddArtistRequest } from '@/lib/types/search';

export function useAddArtist(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AddArtistRequest) => addArtist(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.artists() });
      onSuccess?.();
    },
  });
}
