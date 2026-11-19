import { useQuery } from "@tanstack/react-query";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { LibrarySort } from "@/lib/types/library";

/** Cards a Library home rail reads, as on the web (HOME_RAIL_SIZE). */
const RAIL_SIZE = 20;

/**
 * `availableOnly` leaves out albums with no file, as the web's Explore and
 * Recently Released rails do.
 */
export function useAlbumRail(sort: LibrarySort, availableOnly = false) {
  return useQuery({
    queryKey: libraryKeys.albumRail(sort),
    queryFn: async () => {
      const page = await getCanonicalLibraryPage({
        kind: "albums",
        source: "all",
        page: 1,
        pageSize: RAIL_SIZE,
        sort,
        // The server reads `asc` as newest, latest or most first.
        direction: "asc",
        ...(availableOnly ? { availableOnly: true } : {}),
      });
      return page.albums;
    },
  });
}
