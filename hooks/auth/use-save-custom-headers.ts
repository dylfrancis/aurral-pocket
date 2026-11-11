import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { setCustomHeaders } from "@/lib/api/client";
import { checkServerLive } from "@/lib/api/health";
import { refreshQueueHeaders } from "@/lib/player/player";

/**
 * The server has to answer with the new headers before they're kept: a
 * mistyped secret would otherwise cut the app off from it.
 */
export function useSaveCustomHeaders() {
  const { customHeaders: savedHeaders, saveCustomHeaders } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (headers: Record<string, string>) => {
      setCustomHeaders(headers);
      try {
        await checkServerLive();
      } catch (error) {
        setCustomHeaders(savedHeaders);
        throw error;
      }
      await saveCustomHeaders(headers);
    },
    onSuccess: () => {
      void refreshQueueHeaders();
      // Only what failed, which the proxy may have turned away.
      void queryClient.invalidateQueries({
        predicate: (query) => query.state.status === "error",
      });
    },
  });
}
