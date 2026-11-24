import { useEffect } from "react";
import {
  useIsMutating,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import {
  flowStatusQueryOptions,
  playlistJobsQueryOptions,
} from "@/hooks/flow/use-flow-status";
import { favoriteListsQuery } from "@/hooks/library/use-library-favorites";
import {
  FAVORITES_SAVE_SORT,
  favoriteSaves,
} from "@/hooks/offline/use-favorites-save";
import { useIsOffline } from "@/lib/offline/network";
import {
  applyFavorites,
  refreshSavedPlaylist,
  useFavoritesSave,
  useKeptPlaylistIds,
} from "@/lib/offline/saved-library";
import { libraryKeys } from "@/lib/query-keys";
import type { FlowJob } from "@/lib/types/flow";

/** A read this recent is reused when the app comes back to the front. */
const RECHECK_AFTER_MS = 60 * 1000;
/** How often a Keep Updated playlist is read while the server downloads to it. */
const DOWNLOADING_POLL_MS = 60 * 1000;

/**
 * Keeps Favorites and Keep Updated playlists in step with the server all
 * session. Favorites has no push, and the playlists channel is left to the
 * screens that show one, so both are read again instead.
 */
export function useSavesStayUpdated() {
  useFavoritesStaySaved();
  useKeptPlaylistsStaySaved();
}

function useFavoritesStaySaved() {
  const queryClient = useQueryClient();
  const mode = useFavoritesSave();
  const offline = useIsOffline();
  const { token } = useAuth();
  // A heart that's still on its way shows its guess in the read. Removing a
  // file on that guess would download it again if the request failed.
  const favoriteChanges = useIsMutating({
    mutationKey: libraryKeys.favorites(),
  });
  const { data, isFetching } = useQuery({
    ...favoriteListsQuery(FAVORITES_SAVE_SORT),
    enabled: mode !== null && !offline && !!token,
    staleTime: RECHECK_AFTER_MS,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!mode || !data || isFetching || favoriteChanges > 0) return;
    let stale = false;
    favoriteSaves(queryClient, data, mode)
      .then((saves) => (stale ? undefined : applyFavorites(saves)))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [mode, data, isFetching, favoriteChanges, queryClient]);
}

function isDownloading(job: FlowJob): boolean {
  return (
    job.status === "pending" ||
    job.status === "downloading" ||
    job.status === "cancel_requested"
  );
}

function useKeptPlaylistsStaySaved() {
  const queryClient = useQueryClient();
  const ids = useKeptPlaylistIds();
  const offline = useIsOffline();
  const { token } = useAuth();
  const reads = useQueries({
    queries: ids.map((id) => ({
      ...playlistJobsQueryOptions(id),
      enabled: !offline && !!token,
      staleTime: RECHECK_AFTER_MS,
      refetchOnWindowFocus: true,
      // Tracks still downloading are saved once they finish.
      refetchInterval: (query: { state: { data?: FlowJob[] } }) =>
        query.state.data?.some(isDownloading) ? DOWNLOADING_POLL_MS : false,
    })),
  });
  const landed = reads
    .map((read) => (read.isFetching ? "…" : String(read.dataUpdatedAt)))
    .join();

  useEffect(() => {
    const playlists = queryClient.getQueryData(
      flowStatusQueryOptions().queryKey,
    )?.staticPlaylists;
    ids.forEach((id, index) => {
      const read = reads[index];
      if (!read?.data || read.isFetching) return;
      void refreshSavedPlaylist({
        id,
        jobs: read.data,
        playlist: playlists?.find((playlist) => playlist.id === id),
      });
    });
    // `reads` is new each render; `landed` says when it holds something new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, landed, queryClient]);
}
