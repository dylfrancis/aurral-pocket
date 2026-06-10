import { useCallback } from "react";
import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useAuth } from "@/contexts/auth-context";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { getFlowStatus } from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";

const POLL_INTERVAL_MS = 3000;

export function flowStatusQueryOptions() {
  return queryOptions({
    queryKey: flowKeys.status(),
    queryFn: getFlowStatus,
    staleTime: 1000,
    refetchOnWindowFocus: "always",
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

export function useFlowStatus() {
  const { serverUrl, token } = useAuth();
  const isFocused = useIsFocused();
  const enabled = !!serverUrl && !!token;

  const query = useQuery({
    ...flowStatusQueryOptions(),
    enabled,
    refetchInterval: isFocused ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const { refetch } = query;
  useRefreshOnFocus(
    useCallback(() => {
      // refetch() bypasses `enabled`, so guard it ourselves
      if (enabled) refetch();
    }, [enabled, refetch]),
  );

  return query;
}

/**
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary (Expo
 * Router wraps every route automatically), and inside the `(app)` route group
 * (auth is guaranteed there).
 */
export function useFlowStatusSuspense() {
  const isFocused = useIsFocused();

  const query = useSuspenseQuery({
    ...flowStatusQueryOptions(),
    refetchInterval: isFocused ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  useRefreshOnFocus(query.refetch);

  return query;
}
