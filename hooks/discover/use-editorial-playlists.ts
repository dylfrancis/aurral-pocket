import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRouter } from "expo-router";
import * as Burnt from "burnt";
import type { ApiError } from "@/lib/api/client";
import {
  addEditorialPlaylistToLibrary,
  getEditorialLinks,
  getEditorialPlaylist,
  getEditorialShelf,
} from "@/lib/api/search";
import { releaseRouteParams } from "@/lib/library-read";
import { discoverKeys, flowKeys } from "@/lib/query-keys";
import type {
  EditorialPlaylist,
  EditorialPlaylistSummary,
  EditorialTrack,
  TrendingChartsResponse,
} from "@/lib/types/search";
import { useOpenArtist } from "@/hooks/use-open-artist";

export type TrackLinkTarget = Pick<
  EditorialTrack,
  "artistName" | "albumName" | "deezerAlbumId"
>;

const SHELF_STALE_MS = 60 * 60 * 1000;
const PLAYLIST_STALE_MS = 5 * 60 * 1000;
const LINK_STALE_MS = 5 * 60 * 1000;

export function useEditorialShelf() {
  return useQuery({
    queryKey: discoverKeys.editorialShelf(),
    queryFn: () => getEditorialShelf(),
    staleTime: SHELF_STALE_MS,
    gcTime: 2 * SHELF_STALE_MS,
  });
}

export function useEditorialPlaylist(playlistId: string) {
  return useQuery({
    queryKey: discoverKeys.editorialPlaylist(playlistId),
    queryFn: () => getEditorialPlaylist(playlistId),
    staleTime: PLAYLIST_STALE_MS,
  });
}

/** The card's fields travel with the push, so the page has a header at once. */
export function useOpenEditorialPlaylist() {
  const router = useRouter();

  return useCallback(
    (playlist: EditorialPlaylistSummary) => {
      router.push({
        pathname: "/(app)/(tabs)/(discover)/editorial/[id]",
        params: {
          id: playlist.id,
          name: playlist.name,
          artworkUrl: playlist.artworkUrl ?? "",
          trackCount: String(playlist.trackCount),
        },
      });
    },
    [router],
  );
}

export function useAddEditorialPlaylist(playlistId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => addEditorialPlaylistToLibrary(playlistId),
    onSuccess: (saved) => {
      // Set here, not refetched: the server queues the save, so a read right
      // now can still say it isn't saved, and adding from that state makes a
      // second copy.
      queryClient.setQueryData<EditorialPlaylist>(
        discoverKeys.editorialPlaylist(playlistId),
        (cached) =>
          cached && { ...cached, libraryPlaylistId: saved.playlistId },
      );
      // Trending's songs chart is a Deezer playlist saved through this route.
      queryClient.setQueryData<TrendingChartsResponse>(
        discoverKeys.trending(),
        (cached) =>
          cached?.songs?.playlistId === playlistId
            ? {
                ...cached,
                songs: { ...cached.songs, libraryPlaylistId: saved.playlistId },
              }
            : cached,
      );
      void queryClient.invalidateQueries({ queryKey: flowKeys.status() });
      Burnt.toast(
        saved.alreadyAdded
          ? {
              title: "Already in your playlists",
              message: saved.name,
              preset: "done",
            }
          : {
              title: "Added to your playlists",
              message: "Syncs with Deezer daily",
              preset: "done",
            },
      );
    },
    onError: (err: ApiError) => {
      Burnt.toast({
        title: "Couldn't add playlist",
        message: err.message,
        preset: "error",
      });
    },
  });
}

/**
 * Deezer tracks carry no MBIDs, so a tap looks them up first. As on the web, an
 * album that can't be found opens its artist instead.
 */
export function useEditorialTrackLinks(onLeave: () => void, active = true) {
  const router = useRouter();
  const openArtistPage = useOpenArtist();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [lookupRowId, setLookupRowId] = useState<string | null>(null);
  const lookupRunning = useRef(false);
  // A hidden Discover tab stays mounted and its screen focused, so focus alone
  // can't tell that the rows are out of sight.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
    return () => {
      activeRef.current = false;
    };
  }, [active]);

  const openLink = useCallback(
    async (rowId: string, track: TrackLinkTarget, kind: "artist" | "album") => {
      if (lookupRunning.current) return;
      lookupRunning.current = true;
      setLookupRowId(rowId);

      const { artistName } = track;
      const albumName = kind === "album" ? track.albumName : null;
      const deezerAlbumId = kind === "album" ? track.deezerAlbumId : null;

      try {
        const { artistMbid, albumMbid } = await queryClient.fetchQuery({
          queryKey: discoverKeys.editorialLinks(
            artistName,
            albumName,
            deezerAlbumId,
          ),
          queryFn: () =>
            getEditorialLinks({
              artist: artistName,
              album: albumName,
              albumId: deezerAlbumId,
            }),
          staleTime: LINK_STALE_MS,
          retry: false,
        });

        // A slow lookup must not pull back someone who has already moved on.
        if (!activeRef.current || !navigation.isFocused()) return;

        if (!artistMbid) {
          Burnt.toast({
            title: `Couldn't find ${artistName}`,
            preset: "error",
          });
          return;
        }

        onLeave();
        if (albumName && albumMbid) {
          router.push({
            pathname: "/release/[mbid]",
            params: releaseRouteParams({
              mbid: albumMbid,
              title: albumName,
              artistName,
              artistMbid,
            }),
          });
          return;
        }

        openArtistPage({ mbid: artistMbid, name: artistName });
        if (albumName) {
          Burnt.toast({
            title: `Couldn't find ${albumName}. Opened ${artistName} instead.`,
            preset: "none",
          });
        }
      } catch (err) {
        Burnt.toast({
          title: `Couldn't open ${albumName ?? artistName}`,
          message: (err as ApiError)?.message,
          preset: "error",
        });
      } finally {
        lookupRunning.current = false;
        setLookupRowId(null);
      }
    },
    [navigation, onLeave, queryClient, router, openArtistPage],
  );

  const openArtist = useCallback(
    (rowId: string, track: TrackLinkTarget) => openLink(rowId, track, "artist"),
    [openLink],
  );
  const openAlbum = useCallback(
    (rowId: string, track: TrackLinkTarget) => openLink(rowId, track, "album"),
    [openLink],
  );

  return { lookupRowId, openArtist, openAlbum };
}
