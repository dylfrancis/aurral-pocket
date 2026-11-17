import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useDrainRemainingPages } from "@/hooks/library/use-drain-remaining-pages";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { LibraryArtistsParams } from "@/lib/types/library";

/** The server's page cap, so the drain takes the fewest requests. */
const PAGE_SIZE = 100;

const WHOLE_LIST: LibraryArtistsParams = {
  sort: "name",
  status: null,
  favorite: false,
};

/**
 * The artist list reads the canonical library through its paginated route.
 *
 * Aurral 2.6.0 bounded canonical reads, so one query cannot carry the whole
 * library. The screen still needs every artist — search, the phone's sorts
 * and the alphabet index run over the full list — so the hooks below drain
 * the remaining pages eagerly.
 *
 * The read omits availableOnly, so the list follows the server's library
 * view the way the web app's list does. From Aurral 2.9 that view can leave
 * out an artist whose albums are all wanted — see CanonicalPageParams.
 *
 * The whole list, read by name, is cached under `libraryKeys.artists()`, and
 * sorts done on the phone share it. A filter, or an order only the server
 * knows (plays, releases, favorites), is its own view, and keeps the
 * server's page order.
 */
function libraryArtistsInfiniteQueryOptions(params: LibraryArtistsParams) {
  const wholeList =
    params.sort === WHOLE_LIST.sort &&
    params.status === WHOLE_LIST.status &&
    params.favorite === WHOLE_LIST.favorite;
  return infiniteQueryOptions({
    queryKey: wholeList
      ? libraryKeys.artists()
      : libraryKeys.artistsView(params),
    queryFn: ({ pageParam }) =>
      getCanonicalLibraryPage({
        kind: "artists",
        source: "all",
        page: pageParam,
        pageSize: PAGE_SIZE,
        ...(wholeList ? {} : params),
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    select: (data) => data.pages.flatMap((page) => page.artists),
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

export function useLibraryArtists(params = WHOLE_LIST) {
  const { serverUrl, token } = useAuth();

  const query = useInfiniteQuery({
    ...libraryArtistsInfiniteQueryOptions(params),
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
export function useLibraryArtistsSuspense(params = WHOLE_LIST) {
  const query = useSuspenseInfiniteQuery(
    libraryArtistsInfiniteQueryOptions(params),
  );
  useDrainRemainingPages(query);
  return query;
}
