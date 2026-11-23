import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { setArtistInLibrary } from "@/hooks/search/use-library-lookup";
import { addArtist } from "@/lib/api/search";
import { discoverKeys, libraryKeys } from "@/lib/query-keys";
import type {
  AddArtistRequest,
  AddArtistResponse,
  RecentlyAddedArtist,
} from "@/lib/types/search";
import type { Artist, CanonicalPage } from "@/lib/types/library";

function toArtist(data: AddArtistResponse, mbid: string): Artist {
  if (data.artist) return data.artist as Artist;
  return {
    id: "",
    mbid,
    artistName: data.artistName,
    monitored: true,
    addedAt: new Date().toISOString(),
    statistics: { albumCount: 0, trackCount: 0, sizeOnDisk: 0 },
  };
}

/**
 * The callbacks run even after the caller unmounts, as a sheet's content does
 * when it's dismissed mid-request. Callbacks passed to `mutate` wouldn't.
 */
export function useAddArtist(
  onSuccess?: (data: AddArtistResponse, params: AddArtistRequest) => void,
  onError?: (error: Error, params: AddArtistRequest) => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AddArtistRequest) => addArtist(params),
    onError,
    onSuccess: (data: AddArtistResponse, params: AddArtistRequest) => {
      const mbid = params.foreignArtistId;
      const artist = toArtist(data, mbid);
      // Which page the optimistic entry lands in does not matter — the list
      // sorts client-side. It survives only until the next refetch: the
      // canonical library omits artists that have no files yet, and this one
      // was added seconds ago.
      queryClient.setQueryData<InfiniteData<CanonicalPage>>(
        libraryKeys.artists(),
        (old) => {
          if (!old || old.pages.length === 0) return old;
          const pages = [...old.pages];
          const last = pages.length - 1;
          pages[last] = {
            ...pages[last],
            artists: [...pages[last].artists, artist],
          };
          return { ...old, pages };
        },
      );
      queryClient.setQueryData(libraryKeys.artist(artist.mbid), artist);
      setArtistInLibrary(queryClient, artist.mbid, true);

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
          id: mbid,
          mbid,
          artistName: data.artistName,
          addedAt: now,
          added: now,
        };
        queryClient.setQueryData<RecentlyAddedArtist[]>(
          discoverKeys.recentlyAdded(),
          (old) => {
            if (old?.some((a) => a.mbid === mbid)) {
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

      onSuccess?.(data, params);
    },
  });
}
