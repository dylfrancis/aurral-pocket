import type { QueryClient } from "@tanstack/react-query";
import { cachedAlbumCover } from "@/hooks/player/queue-covers";
import { albumRouteParams } from "@/lib/library-read";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import type { AlbumTrack } from "@/lib/types/library";

/** A track's own credit, or else its album's artist. */
export function albumTrackArtist(track: AlbumTrack): string {
  return track.artistName || track.album?.artistName || "";
}

/**
 * The album a track from a list of many albums plays as. Built at tap time,
 * because the artwork fallback is whatever the row's thumbnail lookup found.
 * The list sends no lookups of its own.
 */
export function albumTrackContext(
  track: AlbumTrack,
  queryClient: QueryClient,
): PlayerAlbumContext {
  const albumMbid = track.album?.mbid || null;
  return {
    albumTitle: track.album?.albumName ?? "",
    artistName: albumTrackArtist(track),
    coverPath: track.album?.coverUrl ?? null,
    artworkUrl: cachedAlbumCover(queryClient, albumMbid),
    albumMbid,
    artistMbid: track.album?.artistMbid ?? null,
    albumRef: track.album ? albumRouteParams(track.album).ref : null,
  };
}
