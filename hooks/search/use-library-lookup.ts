import { useMemo } from "react";
import { useLibraryArtists } from "@/hooks/library/use-library-artists";

export function useLibraryLookup() {
  const { data: artists } = useLibraryArtists();

  const mbidSet = useMemo(
    () => new Set(artists?.map((a) => a.mbid)),
    [artists],
  );

  return {
    isInLibrary: (mbid: string) => mbidSet.has(mbid),
    libraryArtists: artists,
  };
}
