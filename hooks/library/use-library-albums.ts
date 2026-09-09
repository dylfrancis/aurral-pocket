import { useQuery } from "@tanstack/react-query";
import { getCanonicalAlbum, getCanonicalArtistAlbums } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/**
 * Read an artist's albums from the paged canonical route.
 *
 * `artistRef` must come from `libraryAlbumsRef`. It identifies the artist on
 * the canonical read path, and it is also the query key, so mutations can
 * invalidate the same entry. The read drains the paged route, so wanted
 * (fileless) albums arrive too.
 *
 * No monitored filter here, unlike the retired Lidarr read. The canonical
 * library copies the monitored flag from Lidarr when Lidarr indexed the
 * album, and leaves it false for albums scanned from the Aurral root, so
 * filtering on it would hide every Aurral-only album.
 */
export function useLibraryAlbums(artistRef: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.albums(artistRef!),
    queryFn: () => getCanonicalArtistAlbums(artistRef!),
    enabled: !!artistRef,
  });
}

/**
 * Read one album from the paged canonical route.
 *
 * `albumRef` must come from `libraryTracksRef`, the same reference the track
 * list uses, so the page reads both halves of an album under one identifier.
 * Only a canonical id matches; a reference that fell back to an MBID or a
 * Lidarr id reads as null, and the page paints from its route params instead.
 */
export function useLibraryAlbum(albumRef: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.album(albumRef!),
    queryFn: () => getCanonicalAlbum(albumRef!),
    enabled: !!albumRef,
  });
}
