import { useQuery } from "@tanstack/react-query";
import { getLibraryAlbums } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

export function useLibraryAlbums(artistId: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.albums(artistId!),
    queryFn: () => getLibraryAlbums(artistId!),
    enabled: !!artistId,
  });
}
