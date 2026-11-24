import { useCallback, useEffect, useReducer, useRef } from "react";
import Constants from "expo-constants";
import {
  addErrorListener,
  addMatchListener,
  addNoMatchListener,
  isShazamAvailable,
  startListening,
  stopListening,
} from "@/modules/shazam";
import {
  initialShazamState,
  shazamReducer,
  type ShazamState,
} from "@/lib/shazam/listening-machine";
import {
  holdPlayback,
  resumeAfterHold,
  type PlaybackHold,
} from "@/lib/player/player";
import { IS_ANDROID } from "@/constants/platform";

/** Listen for at most this long before giving up with a "no match" result. */
const LISTEN_TIMEOUT_MS = 60_000;

/** Android needs a developer token to reach the Shazam catalog; iOS does not. */
function getDeveloperToken(): string | null {
  if (!IS_ANDROID) return null;
  const token = Constants.expoConfig?.extra?.shazamDeveloperToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

export type UseShazam = ShazamState & {
  available: boolean;
  start: () => void;
  cancel: () => void;
  reset: () => void;
};

export function useShazam(): UseShazam {
  const [state, dispatch] = useReducer(shazamReducer, initialShazamState);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The player stays paused while the mic listens, so it doesn't hear pocket.
  const holdRef = useRef<PlaybackHold | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // A stop sent while the mic is still starting, as behind the permission
  // prompt, finds nothing to stop.
  const lastNativeCallRef = useRef<Promise<void>>(Promise.resolve());
  const runInTurn = useCallback((op: () => Promise<void>): Promise<void> => {
    const run = lastNativeCallRef.current.then(op);
    lastNativeCallRef.current = run.catch(() => {});
    return run;
  }, []);

  const endListening = useCallback((): Promise<void> => {
    clearTimer();
    const hold = holdRef.current;
    holdRef.current = null;
    // Playback waits for the mic to give iOS its audio session back.
    return runInTurn(stopListening)
      .catch(() => {})
      .then(() => hold?.release());
  }, [clearTimer, runInTurn]);

  // Subscribe to native events once; the reducer guards against late events.
  useEffect(() => {
    if (!isShazamAvailable) return;

    const subscriptions = [
      addMatchListener((match) => {
        dispatch({ type: "MATCH", match });
        void endListening();
      }),
      addNoMatchListener(() => {
        dispatch({ type: "NO_MATCH" });
        void endListening();
      }),
      addErrorListener((error) => {
        dispatch({ type: "ERROR", error });
        void endListening();
      }),
    ];

    return () => {
      subscriptions.forEach((sub) => sub?.remove());
    };
  }, [endListening]);

  // The session ends with the sheet, and a song that listening paused plays on.
  useEffect(() => {
    return () => {
      endListening()
        .then(resumeAfterHold)
        .catch(() => {});
    };
  }, [endListening]);

  const start = useCallback(() => {
    if (!isShazamAvailable) {
      dispatch({
        type: "ERROR",
        error: { code: "unavailable", message: "ShazamKit is not available" },
      });
      return;
    }

    dispatch({ type: "START" });
    clearTimer();
    holdRef.current?.release();
    const hold = holdPlayback();
    holdRef.current = hold;
    timeoutRef.current = setTimeout(() => {
      dispatch({ type: "TIMEOUT" });
      void endListening();
    }, LISTEN_TIMEOUT_MS);

    // On iOS, listening takes over the audio session, which cuts off a song
    // still playing and skips it.
    hold.paused
      .then(() =>
        runInTurn(async () => {
          if (holdRef.current !== hold) return;
          await startListening(getDeveloperToken());
        }),
      )
      .catch((err: unknown) => {
        if (holdRef.current !== hold) return;
        void endListening();
        dispatch({
          type: "ERROR",
          error: {
            code: "unavailable",
            message:
              err instanceof Error ? err.message : "Could not start listening",
          },
        });
      });
  }, [clearTimer, endListening, runInTurn]);

  const cancel = useCallback(() => {
    void endListening();
    dispatch({ type: "CANCEL" });
  }, [endListening]);

  const reset = useCallback(() => {
    clearTimer();
    dispatch({ type: "RESET" });
  }, [clearTimer]);

  return {
    ...state,
    available: isShazamAvailable,
    start,
    cancel,
    reset,
  };
}
