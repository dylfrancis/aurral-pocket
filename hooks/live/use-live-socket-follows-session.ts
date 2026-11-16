import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/contexts/auth-context";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  onLiveSocketRefused,
  openLiveSocket,
  resumeLiveSocket,
} from "@/lib/api/live-socket";

/**
 * Keeps one socket open for the signed-in session while the app is in the
 * foreground.
 */
export function useLiveSocketFollowsSession() {
  const { serverUrl, token, customHeaders } = useAuth();
  const foreground = useIsForeground();

  useEffect(() => {
    if (!serverUrl || !token || !foreground) return;
    return openLiveSocket({ serverUrl, token, customHeaders });
  }, [serverUrl, token, customHeaders, foreground]);

  // A refused socket means the session may be gone. Asking the server starts
  // the usual re-auth when it is, and its new token reopens the socket. Any
  // other answer, or none, leaves the socket to try again.
  useEffect(
    () =>
      onLiveSocketRefused(() => {
        getMe()
          .then(() => resumeLiveSocket())
          .catch((error) => {
            if (!(error instanceof ApiError && error.status === 401)) {
              resumeLiveSocket();
            }
          });
      }),
    [],
  );
}

/**
 * Only the background counts as leaving. iOS reports inactive while Control
 * Center or the app switcher covers the app, and closing for that would churn.
 */
function useIsForeground(): boolean {
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state !== "background"),
    );
    return () => subscription.remove();
  }, []);
  return foreground;
}
