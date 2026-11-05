import {
  keepPreviousData,
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type {
  Album,
  CanonicalPage,
  LibraryAlbumsParams,
} from "@/lib/types/library";

/** The server's page cap. */
const PAGE_SIZE = 100;

/**
 * Give each album its library artist's name and MBID, as the web's album
 * card does: the page's related artists first, then the album's own artist
 * credit. The credit is a tag string ("Various Artists", "A feat. B") and
 * carries no MBID, so the album page can only link the artist when the page
 * carried it.
 *
 * Pages are flattened in order, dropping an album an earlier page already
 * carried. Offsets shift when the library changes between two page reads, so
 * one album can land on both, and the grid keys rows by id.
 */
function libraryPageAlbums(data: InfiniteData<CanonicalPage>): Album[] {
  const seen = new Set<string>();
  const albums: Album[] = [];
  for (const page of data.pages) {
    const artists = new Map(page.artists.map((artist) => [artist.id, artist]));
    for (const album of page.albums) {
      if (seen.has(album.id)) continue;
      seen.add(album.id);
      const artist = artists.get(album.artistId);
      albums.push({
        ...album,
        artistName: artist?.artistName || album.artistName,
        artistMbid: artist?.mbid || undefined,
      });
    }
  }
  return albums;
}

/**
 * The whole-library album list, one page of 100 at a time.
 *
 * The server searches and sorts, as the web's albums tab does, and the
 * screen asks for the next page as the user nears the end. Nothing drains
 * the list: a large library holds thousands of albums, and one round trip
 * per 100 would stall the first paint and repeat after every library rescan.
 * See useDrainRemainingPages.
 *
 * Changing the view keeps the previous view's albums on screen until the new
 * first page lands (`isPlaceholderData`). A view whose first page fails,
 * including a new search or sort, reaches the route's error boundary, since
 * the grid has no error state of its own. A failed later page keeps what has
 * loaded.
 *
 * The read omits availableOnly, as the web's albums tab does, so the list
 * follows the server's library view: albums that can be played, and albums
 * Aurral is still fetching. See CanonicalPageParams.
 */
export function useLibraryAlbumsAll(params: LibraryAlbumsParams) {
  const { serverUrl, token } = useAuth();

  return useInfiniteQuery({
    queryKey: libraryKeys.albumsAll(params),
    queryFn: ({ pageParam }) =>
      getCanonicalLibraryPage({
        kind: "albums",
        source: "all",
        page: pageParam,
        pageSize: PAGE_SIZE,
        query: params.query,
        genre: params.genre,
        sort: params.sort,
        direction: params.direction,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    select: libraryPageAlbums,
    placeholderData: keepPreviousData,
    throwOnError: (_error, query) => query.state.data === undefined,
    enabled: !!serverUrl && !!token,
  });
}
