import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getArtistPreviewTracks } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import { useAudioPreview } from "./use-audio-preview";
import type { PreviewTrack } from "@/lib/types/library";

export function usePreviewPlayer(
  mbid: string | undefined,
  artistName?: string,
) {
  const { data: tracks, isLoading } = useQuery({
    queryKey: libraryKeys.artistPreviews(mbid!),
    queryFn: () => getArtistPreviewTracks(mbid!, artistName),
    enabled: !!mbid,
    staleTime: 30 * 60 * 1000,
  });

  const { playingId, progress, toggle: toggleAudio, stop } = useAudioPreview();

  const toggle = useCallback(
    (track: PreviewTrack) => toggleAudio(track.id, track.preview_url),
    [toggleAudio],
  );

  return {
    tracks,
    isLoading,
    playingId,
    progress,
    toggle,
    stop,
  };
}
