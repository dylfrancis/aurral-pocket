import { useCallback, useRef, useState } from "react";
import * as Burnt from "burnt";
import {
  readShuffleSongs,
  songListContext,
  usePlayLibrarySongs,
} from "@/hooks/library/use-play-library-songs";
import { useStartRadio } from "@/hooks/player/use-start-radio";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import type { RadioStation } from "@/lib/player/radio";

/** Autoplay builds on the last five plays, and so does Your Radio. */
const SEED_TRACKS = 5;

/**
 * A station from the Library songs played last, as Autoplay seeds one. Before
 * anything has been played it shuffles the Library instead.
 */
export function useYourRadio() {
  const startRadio = useStartRadio();
  const { readAndPlay } = usePlayLibrarySongs();
  const [isStarting, setIsStarting] = useState(false);
  const starting = useRef(false);

  const start = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    setIsStarting(true);
    try {
      const trackIds = await lastPlayedTrackIds();
      if (trackIds.length > 0) {
        await startRadio(yourRadio(trackIds));
      } else {
        await readAndPlay(
          () => readShuffleSongs({}),
          songListContext("Library"),
          { shuffled: true },
        );
      }
    } catch {
      Burnt.toast({ title: "Couldn't start radio", preset: "error" });
    } finally {
      starting.current = false;
      setIsStarting(false);
    }
  }, [startRadio, readAndPlay]);

  return { start, isStarting };
}

/** The Library songs played last, newest first. None before the first play. */
export async function lastPlayedTrackIds(): Promise<string[]> {
  const played = await getCanonicalLibraryPage({
    kind: "tracks",
    source: "all",
    availableOnly: true,
    page: 1,
    pageSize: SEED_TRACKS,
    // Last played first; only songs that have been played come back.
    sort: "played",
    direction: "asc",
  });
  return played.tracks.map((track) => track.id);
}

/** Named "Your Radio" in the queue: a station is "<label> Radio". */
export function yourRadio(trackIds: string[]): RadioStation {
  return { seed: { trackIds }, label: "Your" };
}
