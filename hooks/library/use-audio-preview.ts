import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

export function useAudioPreview() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const audioModeSet = useRef(false);

  const progress =
    status.duration > 0 ? status.currentTime / status.duration : 0;

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
    async (trackId: string, previewUrl: string) => {
      if (!audioModeSet.current) {
        await setAudioModeAsync({ playsInSilentMode: true });
        audioModeSet.current = true;
      }

      if (playingId === trackId) {
        player.pause();
        setPlayingId(null);
        return;
      }

      player.replace({ uri: previewUrl });
      player.play();
      setPlayingId(trackId);
    },
    [playingId, player],
  );

  return { playingId, progress, toggle, stop };
}
