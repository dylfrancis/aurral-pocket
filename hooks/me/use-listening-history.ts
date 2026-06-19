import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getMyListeningHistory, updateMyListeningHistory } from "@/lib/api/me";
import { meKeys } from "@/lib/query-keys";
import type {
  ListenHistorySettings,
  UpdateListenHistoryPayload,
} from "@/lib/types/me";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateListenHistoryPayload) => {
      if (!user?.id) {
        throw new Error("Not signed in");
      }
      return updateMyListeningHistory(user.id, payload);
    },
    onSuccess: (next) => {
      queryClient.setQueryData<ListenHistorySettings>(
        meKeys.listeningHistory(),
        (prev) => ({
          listenHistoryProvider:
            next.listenHistoryProvider ?? prev?.listenHistoryProvider ?? null,
          listenHistoryUsername:
            next.listenHistoryUsername ?? prev?.listenHistoryUsername ?? null,
          lastfmUsername: next.lastfmUsername ?? prev?.lastfmUsername ?? null,
          listenHistoryUrl:
            next.listenHistoryUrl ?? prev?.listenHistoryUrl ?? null,
        }),
      );
    },
  });
}
