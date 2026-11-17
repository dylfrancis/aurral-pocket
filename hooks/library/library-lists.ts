import type { QueryClient } from "@tanstack/react-query";
import { isFilteredListKey, libraryKeys } from "@/lib/query-keys";

/**
 * Reread the Library's own lists after an artist or album joins or leaves it:
 * the Artists, Albums, Songs and Genres screens may sit under the page that
 * changed it.
 */
export function invalidateLibraryLists(queryClient: QueryClient) {
  for (const queryKey of [
    libraryKeys.artists(),
    libraryKeys.albumsAllViews(),
    libraryKeys.songViews(),
    libraryKeys.genres(),
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/**
 * Reread only the lists narrowed by `filter`. Rereading every list would also
 * reshuffle one sorted at random.
 */
export function invalidateFilteredLists(
  queryClient: QueryClient,
  filter: "favorite" | "status",
) {
  return queryClient.invalidateQueries({
    predicate: (query) => isFilteredListKey(query.queryKey, filter),
  });
}
