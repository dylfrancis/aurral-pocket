import { useEffect, useRef, useState } from "react";
import { activeLineIndex } from "@/lib/player/lyrics";
import {
  currentPosition,
  onProgress,
  usePlaybackState,
} from "@/lib/player/player";
import type { LyricLine } from "@/lib/types/lyrics";

/** How often the line is checked between the engine's reports. */
const TICK_MS = 250;
/**
 * The engine reports once a second, and the clock runs on from the last
 * report. Capped, so a stream that stalls while still "playing" can't run the
 * lines ahead of the sound.
 */
const MAX_RUN_ON_MS = 1500;

type Clock = { trackId: string; ms: number; at: number; running: boolean };

function readClock(clock: Clock, now: number): number {
  if (!clock.running) return clock.ms;
  return clock.ms + Math.min(now - clock.at, MAX_RUN_ON_MS);
}

/** The synced line being sung, following playback. -1 before the first line. */
export function useActiveLyricLine(
  trackId: string,
  lines: readonly LyricLine[],
): number {
  const running = usePlaybackState() === "playing";
  // Right from the first render, so a view opened mid-song starts on the line.
  const [active, setActive] = useState(() =>
    activeLineIndex(lines, currentPosition() * 1000),
  );
  const clock = useRef<Clock | null>(null);

  useEffect(() => {
    const now = Date.now();
    const last = clock.current;
    // A pause stops the clock where it had got to, not at the last report.
    clock.current =
      last?.trackId === trackId
        ? { trackId, ms: readClock(last, now), at: now, running }
        : { trackId, ms: currentPosition() * 1000, at: now, running };

    const update = () => {
      if (!clock.current) return;
      setActive(activeLineIndex(lines, readClock(clock.current, Date.now())));
    };
    const unsubscribe = onProgress((progress) => {
      if (progress.track.id !== trackId) return;
      clock.current = {
        trackId,
        ms: progress.position * 1000,
        at: Date.now(),
        running,
      };
      update();
    });
    update();
    const timer = running ? setInterval(update, TICK_MS) : null;
    return () => {
      unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, [lines, running, trackId]);

  return active;
}
