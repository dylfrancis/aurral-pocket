import { useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { getAlbumEditions, type AlbumEdition } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

const NO_EDITIONS: AlbumEdition[] = [];

/**
 * An album's editions and the one its page shows: the Library's, else the
 * standard one, until `view` picks another and sets `previewRelease`.
 */
export function useAlbumEditions(
  releaseGroupMbid: string | undefined,
  { inLibrary }: { inLibrary: boolean },
) {
  const { data } = useQuery({
    queryKey: libraryKeys.albumEditions(releaseGroupMbid!),
    queryFn: () => getAlbumEditions(releaseGroupMbid!),
    enabled: !!releaseGroupMbid,
    staleTime: 5 * 60 * 1000,
  });
  const [picked, setPicked] = useState<string | null>(null);

  const editions = data?.editions ?? NO_EDITIONS;
  const library = data?.library ?? null;
  const fallback = library ?? editions[0]?.id ?? null;
  // A Library album whose edition the server can't name has nothing to switch
  // from.
  const visible = editions.length > 1 && (!inLibrary || library !== null);
  const viewing =
    (visible && editions.find((edition) => edition.id === picked)) ||
    editions.find((edition) => edition.id === fallback) ||
    null;
  const previewRelease =
    visible && viewing && viewing.id !== fallback ? viewing.id : undefined;
  const libraryEdition =
    editions.find((edition) => edition.id === library) ?? null;

  return {
    editions,
    library,
    visible,
    viewing,
    previewRelease,
    libraryEdition,
    view: setPicked,
  };
}

/**
 * Reread what depends on an album's Library edition: the editions' Library
 * mark, and the tracks and clips the server picks when none is named.
 */
export function invalidateEditionReads(
  queryClient: QueryClient,
  releaseGroupMbid: string,
) {
  return Promise.all(
    [
      libraryKeys.albumEditions(releaseGroupMbid),
      libraryKeys.releaseGroupTrackLists(releaseGroupMbid),
      libraryKeys.releaseGroupPreviewLists(releaseGroupMbid),
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
