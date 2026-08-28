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
          listenHistoryProvider: settled(
            next.listenHistoryProvider,
            prev?.listenHistoryProvider,
          ),
          listenHistoryUsername: settled(
            next.listenHistoryUsername,
            prev?.listenHistoryUsername,
          ),
          lastfmUsername: settled(next.lastfmUsername, prev?.lastfmUsername),
          listenHistoryUrl: settled(
            next.listenHistoryUrl,
            prev?.listenHistoryUrl,
          ),
        }),
      );
    },
  });
}

/**
 * The value to cache for one setting. A null answer is the server saying the
 * setting is now empty, not a gap to fill from what was there before: saving
 * the "local" provider clears the username, and falling back would leave the
 * old account name on screen. Only a key the response omits falls back.
 */
function settled<T>(next: T | undefined, previous: T | undefined): T | null {
  if (next !== undefined) return next;
  return previous ?? null;
}
