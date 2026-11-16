import { useCallback, useEffect, useMemo } from "react";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import type { EditorialTrackItem } from "@/components/discover/EditorialTrackRow";
import { useEditorialTrackLinks } from "@/hooks/discover/use-editorial-playlists";
import { useAudioPreview } from "@/hooks/library/use-audio-preview";
import { toastNotSaved } from "@/hooks/offline/toast-not-saved";
import { isOffline } from "@/lib/offline/network";
import { playQueueFrom } from "@/lib/player/player";
import {
  queueTrackContext,
  queueTrackToPlayerTrack,
} from "@/lib/player/track-item";
import type { LibraryQueueTrack } from "@/lib/types/library";

/**
 * The id the player knows a row's sound by. A track the Library has plays as
 * that Library track, so another screen playing it lights this row too.
 */
export function rowPlayerId({ id, track }: EditorialTrackItem) {
  return track.owned?.id ?? id;
}

/** Played alone, as a row's clip is. */
async function playLibraryTrack(
  owned: LibraryQueueTrack,
  artworkUrl: string | null,
) {
  const item = queueTrackToPlayerTrack(owned, artworkUrl);
  try {
    const started =
      item !== null &&
      (await playQueueFrom(
        [item],
        item.id,
        queueTrackContext(owned, artworkUrl),
      ));
    if (!started && isOffline()) toastNotSaved();
  } catch (error) {
    Burnt.toast({
      title: "Playback failed",
      message: error instanceof Error ? error.message : String(error),
      preset: "error",
    });
  }
}

/** Re-renders on every player tick. */
export function usePreviewPlayback() {
  const { playingId, loadingId, progress, toggle, toggleItem, stop } =
    useAudioPreview();

  const togglePreview = useCallback(
    ({ id, track }: EditorialTrackItem) => {
      const { owned } = track;
      if (owned) {
        void Haptics.selectionAsync();
        void toggleItem(owned.id, () =>
          playLibraryTrack(owned, track.artworkUrl),
        );
        return;
      }
      if (!track.preview_url) return;
      void Haptics.selectionAsync();
      void toggle(id, track.preview_url, {
        title: track.trackName,
        artist: track.artistName,
        album: track.albumName ?? undefined,
        artwork: track.artworkUrl,
      });
    },
    [toggle, toggleItem],
  );

  return { playingId, loadingId, progress, togglePreview, stopPreview: stop };
}

export function useRowLinks(onLeave: () => void, active = true) {
  const { lookupRowId, openArtist, openAlbum } = useEditorialTrackLinks(
    onLeave,
    active,
  );

  const openRowArtist = useCallback(
    ({ id, track }: EditorialTrackItem) => void openArtist(id, track),
    [openArtist],
  );
  const openRowAlbum = useCallback(
    ({ id, track }: EditorialTrackItem) => void openAlbum(id, track),
    [openAlbum],
  );

  return useMemo(
    () => ({ lookupRowId, openRowArtist, openRowAlbum, openAlbum }),
    [lookupRowId, openRowArtist, openRowAlbum, openAlbum],
  );
}

export function usePreviewRows() {
  const playback = usePreviewPlayback();
  const { stopPreview } = playback;
  useEffect(() => () => stopPreview(), [stopPreview]);
  const links = useRowLinks(stopPreview);
  return { ...playback, ...links };
}
