import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getLyrics } from "@/lib/api/lyrics";
import { lyricsLookupFor } from "@/lib/player/lyrics";
import type { PlayerTrack } from "@/lib/player/track-item";
import { playerKeys } from "@/lib/query-keys";
import type { Lyrics } from "@/lib/types/lyrics";

export type TrackLyrics = {
  /** This track's lyrics. Null while they load, and when Aurral has none. */
  lyrics: Lyrics | null;
  /**
   * True when the track has lyrics. While a new track's lyrics load, the last
   * track's answer stands, so the player keeps its layout until this one's
   * is in rather than jumping on every track change.
   */
  available: boolean;
};

export function useTrackLyrics(track: PlayerTrack | null): TrackLyrics {
  const lookup = track ? lyricsLookupFor(track) : null;
  const { data, isPlaceholderData } = useQuery({
    queryKey: playerKeys.lyrics(lookup ?? { artist: "", title: "" }),
    queryFn: () => (lookup ? getLyrics(lookup) : null),
    enabled: lookup !== null,
    // Aurral keeps what LRCLIB sends for a day, and a file's own lyrics
    // change only when someone edits them.
    staleTime: Infinity,
    // A failed lookup reads as no lyrics. Retries would hold the last track's
    // layout and a spinner for seconds on every track change, such as offline.
    retry: false,
    placeholderData: keepPreviousData,
  });
  if (!lookup) return { lyrics: null, available: false };
  return {
    lyrics: isPlaceholderData ? null : (data ?? null),
    available: data != null,
  };
}
