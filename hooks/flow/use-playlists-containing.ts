import { useQuery } from "@tanstack/react-query";
import { getPlaylistsContaining } from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";
import type { SharedPlaylistTrack } from "@/lib/types/flow";

/**
 * Ids of the static playlists that already hold the track. Read fresh on
 * every mount, since another device or the web may have added it since.
 */
export function usePlaylistsContaining(track: SharedPlaylistTrack) {
  return useQuery({
    queryKey: flowKeys.containing(track),
    queryFn: () => getPlaylistsContaining(track),
    staleTime: 0,
  });
}
