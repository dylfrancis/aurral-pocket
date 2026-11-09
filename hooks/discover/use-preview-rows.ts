import { useCallback, useEffect, useMemo } from "react";
import * as Haptics from "expo-haptics";
import type { EditorialTrackItem } from "@/components/discover/EditorialTrackRow";
import { useEditorialTrackLinks } from "@/hooks/discover/use-editorial-playlists";
import { useAudioPreview } from "@/hooks/library/use-audio-preview";

/** Re-renders on every player tick. */
export function usePreviewPlayback() {
  const { playingId, loadingId, progress, toggle, stop } = useAudioPreview();

  const togglePreview = useCallback(
    ({ id, track }: EditorialTrackItem) => {
      if (!track.preview_url) return;
      void Haptics.selectionAsync();
      void toggle(id, track.preview_url, {
        title: track.trackName,
        artist: track.artistName,
        album: track.albumName ?? undefined,
        artwork: track.artworkUrl,
      });
    },
    [toggle],
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
