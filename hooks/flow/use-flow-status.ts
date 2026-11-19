import { useCallback } from "react";
import {
  queryOptions,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useAuth } from "@/contexts/auth-context";
import { useLiveChannel } from "@/hooks/live/use-live-channel";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { getFlowStatus, getPlaylistJobs } from "@/lib/api/flow";
import { isLiveSocketConnected } from "@/lib/api/live-socket";
import { flowKeys } from "@/lib/query-keys";

const FALLBACK_POLL_MS = 3000;

export function flowStatusQueryOptions() {
  return queryOptions({
    queryKey: flowKeys.status(),
    queryFn: getFlowStatus,
    staleTime: 1000,
    refetchOnWindowFocus: "always",
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

/**
 * Writes each pushed playlist status into the status cache, then calls
 * `onPush`. Aurral builds one per listener and sends it at once when the
 * channel is first subscribed or the socket reconnects.
 */
export function usePlaylistStatusPushes(
  enabled: boolean,
  onPush?: () => void,
): { isConnected: boolean } {
  const queryClient = useQueryClient();
  return useLiveChannel(
    "playlists",
    ["playlist_status"],
    (message) => {
      queryClient.setQueryData(flowKeys.status(), message.status);
      onPush?.();
    },
    { enabled },
  );
}

/**
 * Polls, and refetches on resume, only while the socket is down. The socket
 * closes in the background, so a resume from there still refetches.
 */
function statusRefreshOptions(isFocused: boolean, isConnected: boolean) {
  return {
    refetchInterval: isFocused && !isConnected ? FALLBACK_POLL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: isConnected ? false : "always",
  } as const;
}

export function useFlowStatus() {
  const { serverUrl, token } = useAuth();
  const isFocused = useIsFocused();
  const enabled = !!serverUrl && !!token;
  const { isConnected } = usePlaylistStatusPushes(enabled && isFocused);

  const query = useQuery({
    ...flowStatusQueryOptions(),
    ...statusRefreshOptions(isFocused, isConnected),
    enabled,
  });

  const { refetch } = query;
  useRefreshOnFocus(
    useCallback(() => {
      // refetch() bypasses `enabled`, so guard it ourselves. While connected,
      // subscribing sends the status, or another listener kept it current.
      if (enabled && !isLiveSocketConnected()) refetch();
    }, [enabled, refetch]),
  );

  return query;
}

export function playlistJobsQueryOptions(playlistId: string) {
  return queryOptions({
    queryKey: flowKeys.jobs(playlistId),
    queryFn: () => getPlaylistJobs(playlistId),
    staleTime: 1000,
  });
}

/**
 * Track jobs for one flow or shared playlist. The status carries no jobs, so
 * each status push refetches them.
 */
export function usePlaylistJobs(playlistId: string | undefined) {
  const { serverUrl, token } = useAuth();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const enabled = !!serverUrl && !!token && !!playlistId;
  const { isConnected } = usePlaylistStatusPushes(enabled && isFocused, () => {
    void queryClient.invalidateQueries(
      { queryKey: flowKeys.jobs(playlistId!), exact: true },
      { cancelRefetch: false },
    );
  });

  return useQuery({
    ...playlistJobsQueryOptions(playlistId ?? ""),
    enabled,
    refetchInterval: isFocused && !isConnected ? FALLBACK_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary (Expo
 * Router wraps every route automatically), and inside the `(app)` route group
 * (auth is guaranteed there).
 */
export function useFlowStatusSuspense() {
  const isFocused = useIsFocused();
  const { isConnected } = usePlaylistStatusPushes(isFocused);

  const query = useSuspenseQuery({
    ...flowStatusQueryOptions(),
    ...statusRefreshOptions(isFocused, isConnected),
  });

  const { refetch } = query;
  useRefreshOnFocus(
    useCallback(() => {
      if (!isLiveSocketConnected()) void refetch();
    }, [refetch]),
  );

  return query;
}
