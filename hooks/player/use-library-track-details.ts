import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import type { TrackFavorite } from "@/lib/api/library";
import { libraryIdsOf, type PlayerTrack } from "@/lib/player/track-item";
import type { Track } from "@/lib/types/library";

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
  const { found } = useAlbumEntry(
    track,
    !known.favorite || known.bitrateKbps === null,
  );
  if (!found) return known;
  return {
    favorite: known.favorite ?? songFavorite(found),
    bitrateKbps: known.bitrateKbps ?? found.bitrateKbps ?? null,
  };
}

/**
 * The playing track's favorite alone, so its album is read only when the
 * track has none. `isPending` while that read runs.
 */
export function useLibraryTrackFavorite(track: PlayerTrack | null): {
  favorite: TrackFavorite | null;
  isPending: boolean;
} {
  const known = track?.favorite ?? null;
  const { found, isPending } = useAlbumEntry(track, !known);
  return { favorite: known ?? songFavorite(found), isPending };
}

function useAlbumEntry(track: PlayerTrack | null, shouldReadAlbum: boolean) {
  const ids = track && shouldReadAlbum ? libraryIdsOf(track.streamPath) : null;
  const { data: albumTracks, isPending } = useLibraryTracks(
    ids?.libraryAlbumId,
  );
  const found = ids
    ? albumTracks?.find((entry) => String(entry.id) === ids.libraryTrackId)
    : undefined;
  return { found, isPending: !!ids && isPending };
}

function songFavorite(entry: Track | undefined): TrackFavorite | null {
  return entry?.identityKey ? { kind: "song", key: entry.identityKey } : null;
}
