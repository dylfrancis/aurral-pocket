import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import type { TrackFavorite } from "@/lib/api/library";
import { libraryIdsOf, type PlayerTrack } from "@/lib/player/track-item";

export type LibraryTrackDetails = {
  favorite: TrackFavorite | null;
  bitrateKbps: number | null;
};

/**
 * The playing track's favorite and bitrate. Radio and a queue picked up from
 * another device send Library tracks without either, so they're read from the
 * track's album, as the web player does.
 */
export function useLibraryTrackDetails(
  track: PlayerTrack | null,
): LibraryTrackDetails {
  const known: LibraryTrackDetails = {
    favorite: track?.favorite ?? null,
    bitrateKbps: track?.bitrateKbps ?? null,
  };
  const ids =
    track && (!known.favorite || known.bitrateKbps === null)
      ? libraryIdsOf(track.streamPath)
      : null;
  const { data: albumTracks } = useLibraryTracks(ids?.libraryAlbumId);
  const found = ids
    ? albumTracks?.find((entry) => String(entry.id) === ids.libraryTrackId)
    : undefined;
  if (!found) return known;
  return {
    favorite:
      known.favorite ??
      (found.identityKey ? { kind: "song", key: found.identityKey } : null),
    bitrateKbps: known.bitrateKbps ?? found.bitrateKbps ?? null,
  };
}
