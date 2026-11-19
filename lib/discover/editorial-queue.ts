import { absolutizeServerPath } from "@/lib/api/client";
import {
  queueTrackToPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { EditorialPlaylist } from "@/lib/types/search";

/**
 * A Browse playlist as one queue, as the web plays a mix: the Library's file
 * where it has the track, else the thirty-second clip. A track with neither
 * is left out.
 */
export function editorialQueue(playlist: EditorialPlaylist): PlayerTrack[] {
  return playlist.tracks.flatMap((track, index): PlayerTrack[] => {
    if (track.owned) {
      const item = queueTrackToPlayerTrack(track.owned, null);
      return item ? [item] : [];
    }
    if (!track.preview_url) return [];
    return [
      {
        id: `preview:${playlist.provider}:${playlist.id}:${index}`,
        title: track.trackName,
        artist: track.artistName,
        album: track.albumName ?? "",
        duration: 0,
        // The server sends Deezer clips as paths. They need no token.
        url: absolutizeServerPath(track.preview_url),
        artwork: track.artworkUrl,
        streamPath: null,
        coverPath: null,
        trackMbid: null,
        artistMbid: null,
        albumMbid: null,
        favorite: null,
        isPreview: true,
      },
    ];
  });
}

export function editorialContext(
  playlist: EditorialPlaylist,
): PlayerAlbumContext {
  return {
    albumTitle: playlist.name,
    artistName: "",
    coverPath: null,
    artworkUrl: null,
    albumMbid: null,
    artistMbid: null,
  };
}
