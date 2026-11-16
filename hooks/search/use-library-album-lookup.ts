import { useCallback, useRef } from "react";
import { useNavigation, useRouter } from "expo-router";
import {
  keepPreviousData,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { lookupLibraryAlbums } from "@/lib/api/library";
import { albumRouteParams, releaseRouteParams } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import type { AlbumLibraryLookup } from "@/lib/types/library";
import type { AlbumStatus, SearchAlbum } from "@/lib/types/search";

// Downloads move an album from partial to available, and nothing invalidates
// the lookup when they finish.
const LOOKUP_STALE_MS = 15_000;

function albumLookupQueryOptions(key: string) {
  return queryOptions({
    queryKey: libraryKeys.albumLookup(key),
    queryFn: () => lookupLibraryAlbums(key.split(",")),
    staleTime: LOOKUP_STALE_MS,
  });
}

/** What the row's badge says about an album the lookup answered for. */
function searchAlbumStatus(entry: AlbumLibraryLookup | undefined): AlbumStatus {
  if (!entry) return "missing";
  return entry.status === "available" ? "available" : "inLibrary";
}

/**
 * Marks search albums from the app contract's album lookup. `openAlbum` waits
 * for the lookup, then opens the Library album or else the release page.
 */
export function useLibraryAlbumLookup(albums: readonly SearchAlbum[]) {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { serverUrl, token } = useAuth();
  const key = [...new Set(albums.map((album) => album.id).filter(Boolean))]
    .sort()
    .join(",");

  const { data } = useQuery({
    ...albumLookupQueryOptions(key),
    enabled: !!serverUrl && !!token && key !== "",
    // The set changes as more results load; keep the marks already known.
    placeholderData: keepPreviousData,
  });

  const statusFor = useCallback(
    (album: SearchAlbum) => searchAlbumStatus(data?.[album.id]),
    [data],
  );

  const opening = useRef(false);
  const openAlbum = useCallback(
    async (album: SearchAlbum) => {
      if (opening.current) return;
      opening.current = true;
      let entry: AlbumLibraryLookup | undefined;
      try {
        const answer = await queryClient.ensureQueryData(
          albumLookupQueryOptions(
            key.split(",").includes(album.id) ? key : album.id,
          ),
        );
        entry = answer[album.id];
      } catch {
        // Without an answer, open the release page, as for an album the
        // Library lacks.
      } finally {
        opening.current = false;
      }
      // A slow lookup must not pull back someone who has already moved on.
      if (!navigation.isFocused()) return;

      // Bare paths, so expo-router resolves them inside the search group.
      if (entry) {
        router.push({
          pathname: "/album/[ref]",
          params: albumRouteParams(
            {
              id: entry.libraryAlbumId,
              canonicalId: entry.libraryAlbumId,
              mbid: album.id,
              albumName: album.title,
              artistId: entry.libraryArtistId,
            },
            album.artistName,
            album.artistMbid ?? undefined,
          ),
        });
        return;
      }
      router.push({
        pathname: "/release/[mbid]",
        params: releaseRouteParams({
          mbid: album.id,
          title: album.title,
          artistName: album.artistName,
          artistMbid: album.artistMbid,
          primaryType: album.primaryType,
          secondaryTypes: album.secondaryTypes,
          releaseDate: album.releaseDate,
        }),
      });
    },
    [key, navigation, queryClient, router],
  );

  return { statusFor, openAlbum };
}
