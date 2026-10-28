import { useQuery } from "@tanstack/react-query";
import { getCanonicalAlbumTracks } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/**
 * Read an album's tracks from the paged canonical route.
 *
 * `albumRef` must come from `libraryTracksRef`. It is the canonical album id,
 * because the paged route matches nothing else. It is also the query key, so
 * mutations can invalidate the same entry. The read asks for wanted
 * (fileless) tracks explicitly, so they arrive whatever the server's library
 * view hides.
 */
export function useLibraryTracks(albumRef: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.tracks(albumRef!),
    queryFn: () => getCanonicalAlbumTracks(albumRef!),
    enabled: !!albumRef,
  });
}
