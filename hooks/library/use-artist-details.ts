import { useQuery } from "@tanstack/react-query";
import { getArtistDetails } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

/** How often the web reads the artist again while its release stats load. */
const STATS_PENDING_REFETCH_MS = 2000;

/**
 * An artist's tags, bio and release groups. Polls while `release-stats-pending`
 * says ListenBrainz's dates and listener counts haven't landed.
 */
export function useArtistDetails(mbid: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.artistDetails(mbid!),
    queryFn: ({ signal }) => getArtistDetails(mbid!, signal),
    enabled: !!mbid,
    staleTime: 30 * 60 * 1000,
    refetchInterval: (query) =>
      query.state.data?.["release-stats-pending"]
        ? STATS_PENDING_REFETCH_MS
        : false,
  });
}
