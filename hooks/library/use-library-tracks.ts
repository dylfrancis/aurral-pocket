import { useQuery } from "@tanstack/react-query";
import { getLibraryTracks } from "@/lib/api/library";
import { LIBRARY_READ } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";

/**
 * Read an album's tracks.
 *
 * `albumRef` must come from `libraryTracksRef`. It identifies the album on the
 * active read path.
 */
export function useLibraryTracks(albumRef: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.tracks(albumRef!),
    queryFn: () => getLibraryTracks(albumRef!, LIBRARY_READ),
    enabled: !!albumRef,
  });
}
