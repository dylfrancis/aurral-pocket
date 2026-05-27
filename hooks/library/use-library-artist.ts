import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getLibraryArtist } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

export function libraryArtistQueryOptions(mbid: string) {
  return queryOptions({
    queryKey: libraryKeys.artist(mbid),
    queryFn: () => getLibraryArtist(mbid),
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

export function useLibraryArtist(mbid: string | undefined) {
  const { serverUrl, token } = useAuth();

  return useQuery({
    ...libraryArtistQueryOptions(mbid!),
    enabled: !!mbid && !!serverUrl && !!token,
  });
}

/**
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary, and
 * inside the `(app)` route group (auth is guaranteed there).
 */
export function useLibraryArtistSuspense(mbid: string) {
  return useSuspenseQuery(libraryArtistQueryOptions(mbid));
}
