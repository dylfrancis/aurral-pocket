import { useEffect, useEffectEvent } from "react";
import { useMutationState } from "@tanstack/react-query";
import {
  useIsFavoriteTrack,
  useToggleFavorite,
  type ToggleFavorite,
} from "@/hooks/library/use-library-favorites";
import { useLibraryTrackFavorite } from "@/hooks/player/use-library-track-details";
import {
  onLockScreenFavoritePress,
  setLockScreenFavorite,
  useCurrentTrack,
  type FavoriteStar,
} from "@/lib/player/player";
import { libraryKeys } from "@/lib/query-keys";

/**
 * Keeps the iOS Lock Screen favorite star in step with the player's heart. Its
 * own component, so a track change re-renders only this.
 */
export function LockScreenFavorite() {
  const track = useCurrentTrack();
  const { favorite, isPending: isFindingFavorite } =
    useLibraryTrackFavorite(track);
  const { data: isFavoriteOnServer = false, isPending: isCheckingFavorite } =
    useIsFavoriteTrack(favorite, track?.trackMbid ?? null);
  const toggleFavorite = useToggleFavorite();
  // A toggle of this song from any screen shows at once.
  const pendingToggle = useMutationState({
    filters: { mutationKey: libraryKeys.favorites(), status: "pending" },
    select: (mutation) => mutation.state.variables as ToggleFavorite,
  }).findLast(
    (toggle) => toggle.kind === favorite?.kind && toggle.key === favorite.key,
  );
  const isFavorite = pendingToggle ? pendingToggle.starred : isFavoriteOnServer;
  const trackId = track && favorite ? track.id : null;

  useEffect(() => {
    // A radio track's favorite comes from its album. Until that's read, the
    // star stays as it was rather than going away at every skip.
    if (isFindingFavorite) return;
    setLockScreenFavorite(trackId === null ? null : { trackId, isFavorite });
  }, [trackId, isFavorite, isFindingFavorite]);
  useEffect(() => () => setLockScreenFavorite(null), []);

  const onPress = useEffectEvent((press: FavoriteStar) => {
    const isThisTrack = favorite !== null && press.trackId === trackId;
    // Like the player's heart, a tap waits for the last answer.
    if (isThisTrack && !isCheckingFavorite && !pendingToggle) {
      if (press.isFavorite !== isFavorite) {
        toggleFavorite.mutate({ ...favorite, starred: press.isFavorite });
      }
      return;
    }
    // Any other tap is put back: one that waited, or one for a track the
    // player has left. With no star to show yet, the effect above sets it
    // once the track's favorite is known.
    if (trackId === null) return;
    setLockScreenFavorite({
      trackId: press.trackId,
      isFavorite: isThisTrack ? isFavorite : !press.isFavorite,
    });
  });
  useEffect(() => onLockScreenFavoritePress((press) => onPress(press)), []);

  return null;
}
