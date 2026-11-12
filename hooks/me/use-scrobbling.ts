import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import {
  getScrobbleStatus,
  linkScrobbler,
  unlinkScrobbler,
  type TokenScrobbler,
} from "@/lib/api/scrobbling";
import { meKeys } from "@/lib/query-keys";
import type { ScrobbleProvider } from "@/lib/types/scrobbling";

export function useScrobbleStatus() {
  const { serverUrl, token } = useAuth();

  return useQuery({
    queryKey: meKeys.scrobbleStatus(),
    queryFn: getScrobbleStatus,
    enabled: !!serverUrl && !!token,
  });
}

/**
 * A link also fills in that service's history username on the server when it
 * has none, so both reads go stale.
 */
export function useRefreshListening() {
  const queryClient = useQueryClient();

  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: meKeys.scrobbleStatus() }),
        queryClient.invalidateQueries({
          queryKey: meKeys.listeningHistory(),
        }),
      ]),
    [queryClient],
  );
}

export function useLinkScrobbler(provider: TokenScrobbler) {
  const refresh = useRefreshListening();

  return useMutation({
    mutationFn: (token: string) => linkScrobbler(provider, token),
    onSuccess: refresh,
  });
}

export function useUnlinkScrobbler(provider: ScrobbleProvider) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unlinkScrobbler(provider),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: meKeys.scrobbleStatus() }),
  });
}
