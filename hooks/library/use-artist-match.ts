import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { invalidateLibraryIndex } from "@/hooks/library/library-lists";
import { getArtistMatches, setLibraryArtistMbid } from "@/lib/api/library";
import { libraryKeys, searchKeys } from "@/lib/query-keys";
import type { Artist } from "@/lib/types/library";

/** The web keeps a search's matches this long. */
const MATCHES_STALE_MS = 5 * 60_000;

export function useArtistMatches(
  libraryArtistId: string,
  query: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: libraryKeys.artistMatches(libraryArtistId, query),
    queryFn: ({ signal }) => getArtistMatches(libraryArtistId, query, signal),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: MATCHES_STALE_MS,
  });
}

/**
 * Saves a match, or clears it with null. The Library index and search reread,
 * since both name the artist by its MBID.
 */
export function useMatchArtist(libraryArtistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mbid: string | null) =>
      setLibraryArtistMbid(libraryArtistId, mbid),
    onSuccess: (result) => {
      // The artist page picks its view from this row before the reread
      // lands, so a stale MBID would open the wrong one.
      queryClient.setQueryData<Artist | null>(
        libraryKeys.canonicalArtist(String(result.id)),
        (old) => (old ? { ...old, mbid: result.mbid ?? "" } : old),
      );
      void invalidateLibraryIndex(queryClient);
      void queryClient.invalidateQueries({
        queryKey: searchKeys.librarySearchAll(),
      });
    },
  });
}
