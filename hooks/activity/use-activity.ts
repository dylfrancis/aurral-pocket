import { useCallback } from "react";
import {
  queryOptions,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useAuth } from "@/contexts/auth-context";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { getActivity } from "@/lib/api/activity";
import { activityKeys } from "@/lib/query-keys";

const ACTIVE_POLL_MS = 15_000;

export function activityQueryOptions() {
  return queryOptions({
    queryKey: activityKeys.list(),
    // Background polls ride Aurral's 15s server cache; only an explicit
    // pull-to-refresh passes refresh=true (see refreshActivity below).
    queryFn: () => getActivity(),
    refetchOnWindowFocus: "always",
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

export function useActivity() {
  const { serverUrl, token } = useAuth();
  const isFocused = useIsFocused();
  const enabled = !!serverUrl && !!token;

  const query = useQuery({
    ...activityQueryOptions(),
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
export function useActivitySuspense() {
  const isFocused = useIsFocused();

  const query = useSuspenseQuery({
    ...activityQueryOptions(),
    refetchInterval: isFocused ? ACTIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
  });

  useRefreshOnFocus(query.refetch);

  return query;
}

/**
 * Pull-to-refresh. Aurral caches the feed for 15s server-side, so a plain
 * refetch right after an action can return the same stale list; refresh=true
 * forces it to rebuild. Resolves false if the fetch failed.
 */
export function useRefreshActivity() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      const data = await getActivity({ refresh: true });
      queryClient.setQueryData(activityKeys.list(), data);
      return true;
    } catch {
      return false;
    }
  }, [queryClient]);
}
