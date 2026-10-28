import { useCallback } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { lookupLibraryArtists } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/**
 * Library membership for the artists a screen shows, from the app contract's
 * batch lookup. Pass every MBID the screen can mark; blanks are skipped.
 *
 * The set of MBIDs is the query key, in any order, so screens that show the
 * same list share one lookup. Adding or removing an artist updates every
 * cached lookup at once (useAddArtist, ArtistDetailLayout).
 */
export function useLibraryLookup(
  mbids: readonly (string | null | undefined)[],
) {
  const { serverUrl, token } = useAuth();
  const key = [...new Set(mbids.filter((mbid): mbid is string => !!mbid))]
    .sort()
    .join(",");

  const { data } = useQuery({
    queryKey: libraryKeys.artistLookup(key),
    queryFn: () => lookupLibraryArtists(key.split(",")),
    enabled: !!serverUrl && !!token && key !== "",
    // The set changes as results stream in; keep the marks already known.
    placeholderData: keepPreviousData,
  });

  const isInLibrary = useCallback(
    (mbid: string) => data?.[mbid] === true,
    [data],
  );

  return { isInLibrary };
}
