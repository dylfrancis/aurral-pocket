import { useCallback, useMemo } from "react";
import { useCatalogSearch } from "@/hooks/search/use-catalog-search";
import { useLibrarySearch } from "@/hooks/search/use-library-search";
import { useTagSuggestions } from "@/hooks/search/use-tag-suggestions";
import { mergeAlbums, mergeArtists, mergeSongs } from "@/lib/search-results";

/** From two characters a search runs. A tag search starts with "#". */
export function searchQueryKind(query: string) {
  const trimmed = query.trimStart();
  if (trimmed.startsWith("#")) {
    const tag = trimmed.slice(1).trim();
    return { isTagSearch: true, tag, hasQuery: tag.length >= 2 };
  }
  return { isTagSearch: false, tag: "", hasQuery: query.trim().length >= 2 };
}

/**
 * Tags, artists, albums, songs and playlists for one search, only from
 * answers to this query.
 */
export function useSearchResults(query: string) {
  const { isTagSearch, tag, hasQuery } = searchQueryKind(query);
  const textQuery = isTagSearch ? "" : query;

  const catalog = useCatalogSearch(textQuery);
  const library = useLibrarySearch(textQuery);
  const { data: tags } = useTagSuggestions(isTagSearch ? tag : textQuery);

  const isTextSearch = hasQuery && !isTagSearch;
  const catalogPending =
    isTextSearch && (catalog.isLoading || catalog.isPlaceholderData);
  const libraryPending =
    isTextSearch && (library.isLoading || library.isPlaceholderData);
  const catalogData =
    isTextSearch && !catalogPending ? catalog.data : undefined;
  const libraryData =
    isTextSearch && !libraryPending ? library.data : undefined;

  const artists = useMemo(
    () => mergeArtists(libraryData?.artists ?? [], catalogData?.artists ?? []),
    [libraryData, catalogData],
  );
  const albums = useMemo(
    () => mergeAlbums(libraryData?.albums ?? [], catalogData?.albums ?? []),
    [libraryData, catalogData],
  );
  const songs = useMemo(
    () => mergeSongs(libraryData?.tracks ?? [], catalogData?.songs ?? []),
    [libraryData, catalogData],
  );
  const playlists = libraryData?.playlists ?? [];

  const catalogDown =
    isTextSearch &&
    !catalogPending &&
    (catalog.isError || catalogData?.status === "unavailable");

  const { refetch: refetchCatalog } = catalog;
  const { refetch: refetchLibrary } = library;
  const retryCatalog = useCallback(
    () => void refetchCatalog(),
    [refetchCatalog],
  );
  const refetch = useCallback(
    () => Promise.all([refetchCatalog(), refetchLibrary()]),
    [refetchCatalog, refetchLibrary],
  );

  const pending = catalogPending || libraryPending;
  const isEmpty =
    artists.length + albums.length + songs.length + playlists.length === 0;

  return {
    isTagSearch,
    hasQuery,
    tags: hasQuery ? (tags ?? []) : [],
    artists,
    albums,
    songs,
    playlists,
    /** Either source is still answering, so a merged section may grow. */
    pending,
    catalogDown,
    retryCatalog,
    refetch,
    /** Every source answered, and no artist, album, song or playlist matched. */
    nothingFound: isTextSearch && !pending && isEmpty,
  };
}

export type SearchResultsData = ReturnType<typeof useSearchResults>;
