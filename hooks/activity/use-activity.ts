import { useCallback } from "react";
import {
  queryOptions,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
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
