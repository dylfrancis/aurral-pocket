import { useCallback, useRef } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useIsFocused } from "expo-router/react-navigation";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { activityPageFilter, type ActivityView } from "@/lib/activity-views";
import { getActivityPage } from "@/lib/api/activity";
import { activityKeys } from "@/lib/query-keys";
import type {
  ActivityItem,
  ActivityPage,
  ActivityStatus,
} from "@/lib/types/activity";

const ACTIVE_POLL_MS = 15_000;

/** The web's page size. */
export const ACTIVITY_PAGE_SIZE = 25;

/**
 * The pages in order, without a row an earlier page already carried: offsets
 * shift when activity arrives between reads.
 */
function flattenActivityPages(data: InfiniteData<ActivityPage>) {
  const seen = new Set<string>();
  const items: ActivityItem[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return { items, first: data.pages[0] };
}

/**
 * Reads a page at a time as the list scrolls and polls the loaded pages while
 * focused. `page` is the first page, which carries the causes, filters,
 * cancelable count and pause.
 */
export function useActivityPages(
  view: ActivityView,
  filter: { status: ActivityStatus | null; cause: string | null },
) {
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const pageFilter = activityPageFilter(view);
  const params = {
    view: pageFilter.view,
    status: pageFilter.status ?? filter.status,
    cause: pageFilter.view === "queue" ? filter.cause : null,
  };
  // Set by a pull-to-refresh, so only that read rebuilds Aurral's 15s cache.
  const forceRefresh = useRef(false);

  const query = useInfiniteQuery({
    queryKey: activityKeys.pages(params),
    queryFn: ({ pageParam }) => {
      const refresh = pageParam === 0 && forceRefresh.current;
      if (refresh) forceRefresh.current = false;
      return getActivityPage({
        ...params,
        offset: pageParam,
        limit: ACTIVITY_PAGE_SIZE,
        refresh,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastOffset) => {
      const next = lastOffset + lastPage.items.length;
      return lastPage.items.length > 0 && next < lastPage.matching
        ? next
        : undefined;
    },
    select: flattenActivityPages,
    placeholderData: keepPreviousData,
    refetchInterval: isFocused ? ACTIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    // Only a view's first load has nothing else to show. A filter that fails
    // to load leaves the screen up, with a retry, and keeps polling.
    throwOnError: (_error, q) =>
      q.state.data === undefined && !filter.status && !filter.cause,
  });

  const { refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useRefreshOnFocus(refetch);

  /**
   * Pull-to-refresh. Aurral caches activity for 15s server-side, so a plain
   * refetch right after an action can return the same stale page.
   */
  const refresh = useCallback(async () => {
    forceRefresh.current = true;
    const result = await refetch();
    // After the rebuild, so the view menu's counts read it too.
    void queryClient.invalidateQueries({ queryKey: activityKeys.counts() });
    return result;
  }, [refetch, queryClient]);

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    items: query.data?.items ?? [],
    page: query.data?.first,
    isPending: query.isPending,
    isError: query.isError,
    isPlaceholderData: query.isPlaceholderData,
    isFetchingNextPage,
    refetch,
    refresh,
    loadMore,
  };
}

export type ActivityCounts = Record<ActivityView, number>;

async function getActivityCounts(): Promise<ActivityCounts> {
  const [queue, history] = await Promise.all([
    getActivityPage({ view: "queue", limit: 1 }),
    getActivityPage({ view: "history", limit: 1 }),
  ]);
  return {
    queue: queue.total,
    review: queue.filters.find((f) => f.id === "review")?.count ?? 0,
    history: history.total,
  };
}

/** Each view's unfiltered count, for the view menu. */
export function useActivityCounts() {
  const isFocused = useIsFocused();
  const query = useQuery({
    queryKey: activityKeys.counts(),
    queryFn: getActivityCounts,
    refetchInterval: isFocused ? ACTIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
  useRefreshOnFocus(query.refetch);
  return query.data;
}
