import { useEffect } from "react";
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/** The server's page cap, so the drain takes the fewest requests. */
const PAGE_SIZE = 100;

/**
 * The artist list reads the canonical library through its paginated route.
 *
 * Aurral 2.6.0 bounded canonical reads, so one query cannot carry the whole
 * library. The screen still needs every artist — search, sort, and the
 * alphabet index all run on the client over the full list — so the hooks
 * below drain the remaining pages eagerly.
 *
 * Known gap, accepted for this list: an artist with no files yet is missing
 * until a scan finds its first file — see lib/library-read.ts.
 *
 * The server's page order is not depended on: the screen re-sorts the
 * flattened list, so pages may arrive in any order the server chooses.
 */
function libraryArtistsInfiniteQueryOptions() {
  return infiniteQueryOptions({
    queryKey: libraryKeys.artists(),
    queryFn: ({ pageParam }) =>
      getCanonicalLibraryPage({
        kind: "artists",
        source: "all",
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    select: (data) => data.pages.flatMap((page) => page.artists),
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

/**
 * `cancelRefetch: false` lets two mounted consumers of this query share one
 * in-flight request instead of restarting each other's. The error guard
 * stops the loop when a page fails — React Query has already retried it —
 * so a failing server is not hammered; pull-to-refresh starts the drain
 * again.
 */
function useDrainRemainingPages(query: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  fetchNextPage: (options?: { cancelRefetch?: boolean }) => Promise<unknown>;
}) {
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isError) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
}

export function useLibraryArtists() {
  const { serverUrl, token } = useAuth();

  const query = useInfiniteQuery({
    ...libraryArtistsInfiniteQueryOptions(),
    enabled: !!serverUrl && !!token,
  });
  useDrainRemainingPages(query);
  return query;
}

/**
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary, and
 * inside the `(app)` route group (auth is guaranteed there). Suspends only on
 * the first page; the drain never suspends.
 */
export function useLibraryArtistsSuspense() {
  const query = useSuspenseInfiniteQuery(libraryArtistsInfiniteQueryOptions());
  useDrainRemainingPages(query);
  return query;
}
