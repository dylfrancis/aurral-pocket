import { useQuery } from "@tanstack/react-query";
import { getCanonicalAlbum, getCanonicalArtistAlbums } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/**
 * Read an artist's albums. `artistRef` must come from `libraryAlbumsRef`; it
 * is also the query key, so mutations invalidate the same entry.
 */
export function useLibraryAlbums(artistRef: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.albums(artistRef!),
    queryFn: () => getCanonicalArtistAlbums(artistRef!),
    enabled: !!artistRef,
  });
}

/**
 * Read one album from the paged Library route.
 *
 * `albumRef` must come from `libraryTracksRef`, the same reference the track
 * list uses, so the page reads both halves of an album under one identifier.
 * Only a Library album id matches; a reference that fell back to an MBID
 * reads as null, and the page paints from its route params instead.
 */
export function useLibraryAlbum(albumRef: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.album(albumRef!),
    queryFn: () => getCanonicalAlbum(albumRef!),
    enabled: !!albumRef,
  });
}
