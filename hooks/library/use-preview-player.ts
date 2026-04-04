import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useQuery } from '@tanstack/react-query';
import { getArtistPreviewTracks } from '@/lib/api/library';
import { libraryKeys } from '@/lib/query-keys';
import type { PreviewTrack } from '@/lib/types/library';

export function usePreviewPlayer(mbid: string | undefined, artistName?: string) {
  const { data: tracks, isLoading } = useQuery({
    queryKey: libraryKeys.artistPreviews(mbid!),
    queryFn: () => getArtistPreviewTracks(mbid!, artistName),
    enabled: !!mbid,
    staleTime: 30 * 60 * 1000,
  });

  const [playingId, setPlayingId] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const audioModeSet = useRef(false);

  const progress =
    status.duration > 0 ? status.currentTime / status.duration : 0;

  // Stop when track finishes
  useEffect(() => {
    if (status.didJustFinish) {
      setPlayingId(null);
    }
  }, [status.didJustFinish]);

  const stop = useCallback(() => {
    player.pause();
    setPlayingId(null);
  }, [player]);

  const toggle = useCallback(
    async (track: PreviewTrack) => {
      if (!audioModeSet.current) {
        await setAudioModeAsync({ playsInSilentMode: true });
        audioModeSet.current = true;
      }

      // Tapping currently playing track — pause it
      if (playingId === track.id) {
        player.pause();
        setPlayingId(null);
        return;
      }

      // Play new track
      player.replace({ uri: track.preview_url });
      player.play();
      setPlayingId(track.id);
    },
    [playingId, player],
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
