import { useQuery } from "@tanstack/react-query";
import { getLibraryAlbums } from "@/lib/api/library";
import { LIBRARY_READ, READS_CANONICAL } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";

/**
 * Read an artist's albums.
 *
 * `artistRef` must come from `libraryAlbumsRef`. It identifies the artist on
 * the active read path, and it is also the query key, so mutations can
 * invalidate the same entry.
 */
export function useLibraryAlbums(artistRef: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.albums(artistRef!),
    queryFn: () => getLibraryAlbums(artistRef!, LIBRARY_READ),
    enabled: !!artistRef,
    // Lidarr returns every album it knows for an artist, including ones the
    // user has untracked (monitored === false). Those show up at 0% in "your
    // library". Keep only monitored albums; untracked ones fall back into the
    // "Other Releases" discovery section via the release-group partition.
    //
    // The canonical library holds only albums it found files for, so there is
    // nothing to filter out. It also carries no monitored flag of its own: it
    // copies one from Lidarr when Lidarr indexed the album, and leaves it
    // false for albums scanned from the Aurral root. Filtering on the
    // canonical path would therefore hide every Aurral-only album.
    select: READS_CANONICAL
      ? undefined
      : (albums) => albums.filter((a) => a.monitored),
  });
}
