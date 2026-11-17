import { libraryIdsOf, type PlayerTrack } from "@/lib/player/track-item";
import type { LyricLine, LyricsLookup } from "@/lib/types/lyrics";

/**
 * What GET /lyrics is asked for a track. Null for a preview: it is a cut of
 * the song, so synced lines would land at the wrong times. The lyrics route
 * finds the file from the same Library pair as the stream route, so the
 * stream path is the source.
 */
export function lyricsLookupFor(track: PlayerTrack): LyricsLookup | null {
  if (!track.streamPath || track.isPreview) return null;
  if (!track.artist || !track.title) return null;
  return {
    artist: track.artist,
    title: track.title,
    ...(track.album && { album: track.album }),
    ...libraryIdsOf(track.streamPath),
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
