import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addArtist } from "@/lib/api/search";
import { libraryKeys } from "@/lib/query-keys";
import type { AddArtistRequest, AddArtistResponse } from "@/lib/types/search";
import type { Artist } from "@/lib/types/library";

function toArtist(data: AddArtistResponse): Artist {
  if (data.artist) return data.artist as Artist;
  return {
    id: "",
    mbid: data.foreignArtistId,
    foreignArtistId: data.foreignArtistId,
    artistName: data.artistName,
    monitored: true,
    monitorOption: "all",
    addedAt: new Date().toISOString(),
    statistics: { albumCount: 0, trackCount: 0, sizeOnDisk: 0 },
  };
}

export function useAddArtist(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AddArtistRequest) => addArtist(params),
    onSuccess: (data: AddArtistResponse) => {
      const artist = toArtist(data);
      queryClient.setQueryData<Artist[]>(libraryKeys.artists(), (old) => [
        ...(old ?? []),
        artist,
      ]);
      queryClient.setQueryData(libraryKeys.artist(artist.mbid), artist);
      onSuccess?.();
    },
  });
}
