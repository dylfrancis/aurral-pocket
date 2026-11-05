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
 * Flatten the pages, naming each album's library artist from the page's
 * related artists, as the web's card does, before the album's own credit.
 * Drops an album an earlier page carried: offsets shift when the library
 * changes between two page reads.
 */
function flattenAlbumPages(data: InfiniteData<CanonicalPage>): Album[] {
  const seenIds = new Set<string>();
  const albums: Album[] = [];
  for (const page of data.pages) {
    const artistsById = new Map(page.artists.map((a) => [a.id, a]));
    for (const album of page.albums) {
      if (seenIds.has(album.id)) continue;
      seenIds.add(album.id);
      const artist = artistsById.get(album.artistId);
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
 * The whole-library album list, searched and sorted by the server and read
 * one page at a time as the screen asks. It never drains: a library can hold
 * thousands of albums (see useDrainRemainingPages).
 *
 * A view change keeps the previous albums on screen until the new first page
 * lands. A failed first page reaches the route's error boundary; a failed
 * later page keeps what has loaded. availableOnly is omitted, as on the web.
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
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    select: flattenAlbumPages,
    placeholderData: keepPreviousData,
    throwOnError: (_error, query) => query.state.data === undefined,
    enabled: !!serverUrl && !!token,
  });
}
