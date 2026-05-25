import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getLibraryArtists } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

export function libraryArtistsQueryOptions() {
  return queryOptions({
    queryKey: libraryKeys.artists(),
    queryFn: getLibraryArtists,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

export function useLibraryArtists() {
  const { serverUrl, token } = useAuth();

  return useQuery({
    ...libraryArtistsQueryOptions(),
    enabled: !!serverUrl && !!token,
  });
}

/**
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary, and
 * inside the `(app)` route group (auth is guaranteed there).
 */
export function useLibraryArtistsSuspense() {
  return useSuspenseQuery(libraryArtistsQueryOptions());
}
