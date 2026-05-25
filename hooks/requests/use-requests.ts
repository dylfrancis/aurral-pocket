import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useAuth } from "@/contexts/auth-context";
import { getRequests } from "@/lib/api/requests";
import { requestsKeys } from "@/lib/query-keys";

const ACTIVE_POLL_MS = 15_000;

export function requestsQueryOptions() {
  return queryOptions({
    queryKey: requestsKeys.list(),
    queryFn: getRequests,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

export function useRequests() {
  const { serverUrl, token } = useAuth();
  const isFocused = useIsFocused();

  return useQuery({
    ...requestsQueryOptions(),
    enabled: !!serverUrl && !!token,
    refetchInterval: isFocused ? ACTIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary, and
 * inside the `(app)` route group (auth is guaranteed there).
 */
export function useRequestsSuspense() {
  const isFocused = useIsFocused();

  return useSuspenseQuery({
    ...requestsQueryOptions(),
    refetchInterval: isFocused ? ACTIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}
