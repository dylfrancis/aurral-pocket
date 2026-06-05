import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addArtist } from "@/lib/api/search";
import { discoverKeys, libraryKeys } from "@/lib/query-keys";
import type {
  AddArtistRequest,
  AddArtistResponse,
  RecentlyAddedArtist,
} from "@/lib/types/search";
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

      // A queued (202) response means the artist was newly added but isn't yet
      // reflected in the server-computed "Recently Added" list (the backend
      // registers it asynchronously). Optimistically prepend it so the rail
      // updates instantly, then mark the query stale (without refetching now —
      // an immediate refetch would race the backend and wipe this entry) so it
      // reconciles to true server ordering on the next fetch. The existing (200)
      // case is already in the library at its real position, so we leave it.
      if (data.queued && !data.artist) {
        const now = new Date().toISOString();
        const entry: RecentlyAddedArtist = {
          id: data.foreignArtistId,
          mbid: data.foreignArtistId,
          foreignArtistId: data.foreignArtistId,
          artistName: data.artistName,
          addedAt: now,
          added: now,
        };
        queryClient.setQueryData<RecentlyAddedArtist[]>(
          discoverKeys.recentlyAdded(),
          (old) => {
            if (old?.some((a) => a.foreignArtistId === entry.foreignArtistId)) {
              return old;
            }
            return [entry, ...(old ?? [])];
          },
        );
        queryClient.invalidateQueries({
          queryKey: discoverKeys.recentlyAdded(),
          refetchType: "none",
        });
      }

      onSuccess?.();
    },
  });
}
