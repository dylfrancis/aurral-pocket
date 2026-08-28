import { buildAuthenticatedUrl } from "@/lib/api/client";
import type { Track } from "@/lib/types/library";

/**
 * One sound as the audio engine takes it.
 *
 * The shape matches the engine's own track type, but it is declared here so
 * that lib/player/player.ts stays the only module that imports the engine.
 */
export type PlayerClip = {
  id: string;
  title: string;
  artist: string;
  album: string;
  /** Seconds. Zero means the engine reads the real length from the stream. */
  duration: number;
  url: string;
  artwork: string | null;
};

/**
 * A queued track: a clip plus the path its URL was built from. The saved
 * queue keeps the path, because the URL's session token does not last. A
 * preview clip has no path and is never restored.
 */
export type PlayerTrack = PlayerClip & { streamPath: string | null };

/** The album a track is played from. The engine shows this on the lock screen. */
export type PlayerAlbumContext = {
  albumTitle: string;
  artistName: string;
  artworkUrl: string | null;
  /**
   * The engine never sees this. The now-playing screen uses it to open the
   * artist page.
   */
  artistMbid: string | null;
};

/**
 * Turn a library track into a playable one. Returns null — meaning "do not
 * start playback", not an error — when the track has no streamPath (Aurral
 * cannot read a file for it, even if Lidarr has one and the row shows a
 * checkmark) or when the session token is gone.
 */
export function toPlayerTrack(
  track: Track,
  album: PlayerAlbumContext,
): PlayerTrack | null {
  if (!track.streamPath) return null;

  const url = buildAuthenticatedUrl(track.streamPath);
  if (!url) return null;

  return {
    id: String(track.id),
    title: track.trackName,
    artist: album.artistName || "Unknown Artist",
    album: album.albumTitle || "Unknown Album",
    duration: 0,
    url,
    artwork: album.artworkUrl || null,
    streamPath: track.streamPath,
  };
}
