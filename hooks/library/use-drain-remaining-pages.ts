import { useEffect } from "react";

/**
 * Fetch every remaining page of an infinite query as soon as it mounts.
 *
 * Only for a collection small enough that draining it is cheap. The server
 * caps a canonical page at 100 rows, and the drain is sequential, so the cost
 * is one round trip per 100 records before the screen is complete.
 *
 * The artist list pays that because everything it does — search, three sort
 * modes, and the alphabet index — runs on the client over the whole list, and
 * an artist count stays in the hundreds where an album or track count does
 * not. A whole-library screen must page as the user scrolls instead, and push
 * search and sort to the server, which supports both (`query`, `sort`,
 * `direction` on /library/canonical) — that is what Aurral's own web library
 * does.
 *
 * `cancelRefetch: false` lets two mounted consumers of this query share one
 * in-flight request instead of restarting each other's. The error guard
 * stops the loop when a page fails — React Query has already retried it —
 * so a failing server is not hammered; pull-to-refresh starts the drain
 * again.
 */
export function useDrainRemainingPages(query: {
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
