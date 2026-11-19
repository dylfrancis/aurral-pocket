import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useArtistQueue } from "@/hooks/library/use-artist-queue";
import { getArtistPreviewTracks } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import { matchTopTracks } from "@/lib/top-tracks";

/**
 * A Library artist's rows wait for its tracks, so a row doesn't flip from clip
 * to Library file as they arrive.
 */
export function useArtistTopTracks(
  mbid: string,
  artistName: string,
  inLibrary: boolean,
) {
  const previews = useQuery({
    queryKey: libraryKeys.artistPreviews(mbid),
    queryFn: () => getArtistPreviewTracks(mbid, artistName),
    staleTime: 30 * 60 * 1000,
  });
  const queue = useArtistQueue(inLibrary ? mbid : undefined);

  const topTracks = useMemo(
    () => matchTopTracks(previews.data ?? [], queue.data ?? []),
    [previews.data, queue.data],
  );

  return {
    topTracks,
    // A failed Library read still leaves the clips to play.
    isLoading: previews.isLoading || (inLibrary && queue.isLoading),
    artistQueue: queue.data,
  };
}
