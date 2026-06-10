import { useCallback } from "react";
import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useAuth } from "@/contexts/auth-context";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { getRequests } from "@/lib/api/requests";
import { requestsKeys } from "@/lib/query-keys";

const ACTIVE_POLL_MS = 15_000;

export function requestsQueryOptions() {
  return queryOptions({
    queryKey: requestsKeys.list(),
    queryFn: getRequests,
    refetchOnWindowFocus: "always",
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

export function useRequests() {
  const { serverUrl, token } = useAuth();
  const isFocused = useIsFocused();
  const enabled = !!serverUrl && !!token;

  const query = useQuery({
    ...requestsQueryOptions(),
    enabled,
    refetchInterval: isFocused ? ACTIVE_POLL_MS : false,
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
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary, and
 * inside the `(app)` route group (auth is guaranteed there).
 */
export function useRequestsSuspense() {
  const isFocused = useIsFocused();

  const query = useSuspenseQuery({
    ...requestsQueryOptions(),
    refetchInterval: isFocused ? ACTIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
  });

  useRefreshOnFocus(query.refetch);

  return query;
}
