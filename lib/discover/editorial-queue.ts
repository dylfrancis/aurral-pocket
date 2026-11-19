import { absolutizeServerPath } from "@/lib/api/client";
import {
  queueTrackToPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { EditorialPlaylist, EditorialTrack } from "@/lib/types/search";

/**
 * A Browse playlist's songs that are in the Library, as one queue. Songs the
 * Library doesn't have are left out, as the page grays them.
 */
export function editorialQueue(playlist: EditorialPlaylist): PlayerTrack[] {
  return playlist.tracks.flatMap((track): PlayerTrack[] => {
    const item = track.owned
      ? queueTrackToPlayerTrack(track.owned, track.artworkUrl)
      : null;
    return item ? [item] : [];
  });
}

/** A song's thirty-second clip, played alone. Null when Deezer has none. */
export function editorialClipItem(
  id: string,
  track: EditorialTrack,
): PlayerTrack | null {
  if (!track.preview_url) return null;
  return {
    id,
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
  };
}

export function editorialContext(
  playlist: Pick<EditorialPlaylist, "name">,
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
