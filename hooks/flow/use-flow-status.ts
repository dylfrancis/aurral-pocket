import { useCallback, useState } from "react";
import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { getFlowStatus } from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";

const POLL_INTERVAL_MS = 3000;

export function flowStatusQueryOptions() {
  return queryOptions({
    queryKey: flowKeys.status(),
    queryFn: getFlowStatus,
    staleTime: 1000,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

/**
 * Tracks screen focus so polling only runs while the route is in view.
 * Shared between the query and suspense variants.
 */
function useFocusPolling() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}

export function useFlowStatus() {
  const { serverUrl, token } = useAuth();
  const focused = useFocusPolling();

  return useQuery({
    ...flowStatusQueryOptions(),
    enabled: !!serverUrl && !!token,
    refetchInterval: focused ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary (Expo
 * Router wraps every route automatically), and inside the `(app)` route group
 * (auth is guaranteed there).
 */
export function useFlowStatusSuspense() {
  const focused = useFocusPolling();

  return useSuspenseQuery({
    ...flowStatusQueryOptions(),
    refetchInterval: focused ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}
