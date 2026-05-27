import { useCallback, useEffect, useReducer, useRef } from "react";
import { Platform } from "react-native";
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

/** Listen for at most this long before giving up with a "no match" result. */
const LISTEN_TIMEOUT_MS = 60_000;

/** Android needs a developer token to reach the Shazam catalog; iOS does not. */
function getDeveloperToken(): string | null {
  if (Platform.OS !== "android") return null;
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

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Subscribe to native events once; the reducer guards against late events.
  useEffect(() => {
    if (!isShazamAvailable) return;

    const subscriptions = [
      addMatchListener((match) => {
        clearTimer();
        dispatch({ type: "MATCH", match });
        void stopListening();
      }),
      addNoMatchListener(() => {
        clearTimer();
        dispatch({ type: "NO_MATCH" });
        void stopListening();
      }),
      addErrorListener((error) => {
        clearTimer();
        dispatch({ type: "ERROR", error });
        void stopListening();
      }),
    ];

    return () => {
      subscriptions.forEach((sub) => sub?.remove());
    };
  }, [clearTimer]);

  // Stop the mic if the consumer unmounts mid-session.
  useEffect(() => {
    return () => {
      clearTimer();
      void stopListening();
    };
  }, [clearTimer]);

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
    timeoutRef.current = setTimeout(() => {
      dispatch({ type: "TIMEOUT" });
      void stopListening();
    }, LISTEN_TIMEOUT_MS);

    startListening(getDeveloperToken()).catch((err: unknown) => {
      clearTimer();
      dispatch({
        type: "ERROR",
        error: {
          code: "unavailable",
          message:
            err instanceof Error ? err.message : "Could not start listening",
        },
      });
    });
  }, [clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    void stopListening();
    dispatch({ type: "CANCEL" });
  }, [clearTimer]);

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
