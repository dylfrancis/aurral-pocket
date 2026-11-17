import { getStreamLoudness } from "@/lib/api/loudness";

/** The web player's target. */
const TARGET_LUFS = -14;

/** The share of full volume that brings a track to the target. Never above 1. */
export function levelingGain(lufs: number): number {
  return Math.min(1, 10 ** ((TARGET_LUFS - lufs) / 20));
}

/** Aurral's answers by stream path: a measurement, or null for none. */
const measured = new Map<string, number | null>();
const asking = new Map<string, AbortController>();
const measuredListeners = new Set<(streamPath: string, lufs: number) => void>();

/** Undefined until Aurral has answered for the path. */
export function knownLoudness(streamPath: string): number | null | undefined {
  return measured.get(streamPath);
}

/**
 * Stops asking about any path not given. A failed request is asked again the
 * next time its path is given.
 */
export function askLoudness(streamPaths: string[]): void {
  const wanted = new Set(streamPaths);
  for (const [streamPath, controller] of asking) {
    if (wanted.has(streamPath)) continue;
    controller.abort();
    asking.delete(streamPath);
  }
  for (const streamPath of wanted) {
    if (measured.has(streamPath) || asking.has(streamPath)) continue;
    const controller = new AbortController();
    asking.set(streamPath, controller);
    getStreamLoudness(streamPath, controller.signal)
      .then((lufs) => {
        if (controller.signal.aborted) return;
        measured.set(streamPath, lufs);
        if (lufs !== null) {
          measuredListeners.forEach((listener) => listener(streamPath, lufs));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (asking.get(streamPath) === controller) asking.delete(streamPath);
      });
  }
}

/** Hear each measurement as Aurral sends it. Returns unsubscribe. */
export function onLoudnessMeasured(
  listener: (streamPath: string, lufs: number) => void,
): () => void {
  measuredListeners.add(listener);
  return function unsubscribe(): void {
    measuredListeners.delete(listener);
  };
}

/**
 * Sign-out drops what's known: after Change Server, a stream path names another
 * server's file.
 */
export function forgetLoudness(): void {
  asking.forEach((controller) => controller.abort());
  asking.clear();
  measured.clear();
}
