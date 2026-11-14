import { useCurrentTrack, usePlaybackState } from "@/lib/player/player";

/**
 * Whether the player is on this track, and playing it. The engine addresses
 * tracks by string id, so `trackId` matches how the queue identifies them.
 */
export function useTrackPlayback(trackId: string) {
  const currentId = useCurrentTrack()?.id ?? null;
  const playbackState = usePlaybackState();
  const isCurrent = currentId !== null && currentId === trackId;
  return { isCurrent, isPlaying: isCurrent && playbackState === "playing" };
}
