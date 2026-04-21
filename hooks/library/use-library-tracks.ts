import { useQuery } from "@tanstack/react-query";
import { getLibraryTracks } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

export function useLibraryTracks(albumId: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.tracks(albumId!),
    queryFn: () => getLibraryTracks(albumId!),
    enabled: !!albumId,
  });
}
