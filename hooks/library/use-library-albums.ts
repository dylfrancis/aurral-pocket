import { useQuery } from "@tanstack/react-query";
import { getLibraryAlbums } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

export function useLibraryAlbums(artistId: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.albums(artistId!),
    queryFn: () => getLibraryAlbums(artistId!),
    enabled: !!artistId,
    // Lidarr returns every album it knows for an artist, including ones the
    // user has untracked (monitored === false). Those show up at 0% in "your
    // library". Keep only monitored albums; untracked ones fall back into the
    // "Other Releases" discovery section via the release-group partition.
    select: (albums) => albums.filter((a) => a.monitored),
  });
}
