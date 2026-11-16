import type { PlayerTrack } from "@/lib/player/track-item";
import type { LyricLine, LyricsLookup } from "@/lib/types/lyrics";

const LIBRARY_STREAM_PATH = /^\/library\/stream\/([^/?#]+)\/([^/?#]+)/;

/**
 * The Library album and track a stream path names. The lyrics route finds the
 * file from the same pair as the stream route, so the path is the source.
 */
function libraryFileOf(streamPath: string) {
  const match = LIBRARY_STREAM_PATH.exec(streamPath);
  if (!match) return null;
  return {
    libraryAlbumId: decodeURIComponent(match[1]),
    libraryTrackId: decodeURIComponent(match[2]),
  };
}

/**
 * What GET /lyrics is asked for a track. Null for a preview: it is a cut of
 * the song, so synced lines would land at the wrong times.
 */
export function lyricsLookupFor(track: PlayerTrack): LyricsLookup | null {
  if (!track.streamPath || track.isPreview) return null;
  if (!track.artist || !track.title) return null;
  return {
    artist: track.artist,
    title: track.title,
    ...(track.album && { album: track.album }),
    ...libraryFileOf(track.streamPath),
  };
}

/** The synced line sung at `positionMs`, or -1 before the first one. */
export function activeLineIndex(
  lines: readonly LyricLine[],
  positionMs: number,
): number {
  for (let index = lines.length - 1; index >= 0; index--) {
    if ((lines[index].start ?? 0) <= positionMs) return index;
  }
  return -1;
}
