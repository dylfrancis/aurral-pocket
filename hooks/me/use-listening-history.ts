import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getMyListeningHistory, updateMyListeningHistory } from "@/lib/api/me";
import { meKeys } from "@/lib/query-keys";
import type { ListenHistorySettings } from "@/lib/types/me";

export function useListeningHistory() {
  const { serverUrl, token } = useAuth();

  return useQuery({
    queryKey: meKeys.listeningHistory(),
    queryFn: getMyListeningHistory,
    enabled: !!serverUrl && !!token,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateListeningHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMyListeningHistory,
    // A read still in flight would land after the save and put the old
    // accounts back on screen.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: meKeys.listeningHistory() });
    },
    // The server answers with every provider, not only the ones sent.
    onSuccess: (next) => {
      queryClient.setQueryData<ListenHistorySettings>(
        meKeys.listeningHistory(),
        next,
      );
    },
  });
}
