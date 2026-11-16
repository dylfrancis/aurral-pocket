import { api } from "./client";
import type { Lyrics, LyricsLookup } from "@/lib/types/lyrics";

/**
 * Lyrics for one track: synced when Aurral has them, otherwise plain. Aurral
 * reads a Library file's own lyrics first (a sidecar .lrc, then its tags) and
 * then asks LRCLIB. Null when it finds none, and for an instrumental.
 */
export async function getLyrics(lookup: LyricsLookup): Promise<Lyrics | null> {
  const r = await api.get<{ lyrics: Lyrics | null }>("/lyrics", {
    params: lookup,
  });
  const lyrics = r.data.lyrics;
  return lyrics && lyrics.lines.length > 0 ? lyrics : null;
}
