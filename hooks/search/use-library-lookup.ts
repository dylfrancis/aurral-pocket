import { useCallback } from "react";
import {
  keepPreviousData,
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { lookupLibraryArtists } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { ArtistLookupBatch } from "@/lib/types/library";

/**
 * The answers cached lookups already hold for these MBIDs, when together they
 * cover every one. A page opened from a row of marked artists then has its
 * answer without a request. The oldest answer used sets the age, so a stale
 * one still refetches.
 */
function cachedLookup(queryClient: QueryClient, mbids: string[]) {
  const data: ArtistLookupBatch = {};
  let updatedAt = Date.now();
  const lookups = queryClient
    .getQueryCache()
    .findAll({ queryKey: libraryKeys.artistLookups() });
  for (const query of lookups) {
    const batch = query.state.data as ArtistLookupBatch | undefined;
    if (!batch) continue;
    for (const mbid of mbids) {
      if (mbid in data || !(mbid in batch)) continue;
      data[mbid] = batch[mbid];
      updatedAt = Math.min(updatedAt, query.state.dataUpdatedAt);
    }
  }
  return mbids.every((mbid) => mbid in data) ? { data, updatedAt } : undefined;
}

function libraryLookupQueryOptions(queryClient: QueryClient, key: string) {
  const mbids = key.split(",");
  return queryOptions({
    queryKey: libraryKeys.artistLookup(key),
    queryFn: () => lookupLibraryArtists(mbids),
    initialData: () => cachedLookup(queryClient, mbids)?.data,
    initialDataUpdatedAt: () => cachedLookup(queryClient, mbids)?.updatedAt,
  });
}

/**
 * Library membership for the artists a screen shows, from the app contract's
 * batch lookup. Pass every MBID the screen can mark; blanks are skipped.
 *
 * The set of MBIDs is the query key, in any order, so screens that show the
 * same list share one lookup. Adding or removing an artist updates every
 * cached lookup at once, through setArtistInLibrary.
 */
export function useLibraryLookup(
  mbids: readonly (string | null | undefined)[],
) {
  const { serverUrl, token } = useAuth();
  const queryClient = useQueryClient();
  const key = [...new Set(mbids.filter((mbid): mbid is string => !!mbid))]
    .sort()
    .join(",");

  const { data, isLoading } = useQuery({
    ...libraryLookupQueryOptions(queryClient, key),
    enabled: !!serverUrl && !!token && key !== "",
    // The set changes as results stream in; keep the marks already known.
    placeholderData: keepPreviousData,
  });

  const isInLibrary = useCallback(
    (mbid: string) => data?.[mbid] === true,
    [data],
  );

  return { isInLibrary, isLoading };
}

/**
 * Mark or unmark an artist in every cached lookup that asked about it, so a
 * screen reflects an add or a removal before the next lookup answers.
 */
export function setArtistInLibrary(
  queryClient: QueryClient,
  mbid: string,
  inLibrary: boolean,
) {
  queryClient.setQueriesData<ArtistLookupBatch>(
    { queryKey: libraryKeys.artistLookups() },
    (old) => (old && mbid in old ? { ...old, [mbid]: inLibrary } : old),
  );
}
