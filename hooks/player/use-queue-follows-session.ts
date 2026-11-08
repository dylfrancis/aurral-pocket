import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getMe } from "@/lib/api/auth";
import { onPlaybackFailed, refreshQueueUrls } from "@/lib/player/player";

/**
 * Keeps queued tracks playable when the session changes under them, as when a
 * restored backup drops every session on the server.
 */
export function useQueueFollowsSession() {
  const { token } = useAuth();

  useEffect(() => {
    refreshQueueUrls().catch(() => {});
  }, [token]);

  // The engine can't tell a lost session from any other stream failure, and
  // while someone is only listening nothing else calls the server. A dead
  // session answers this with a 401, which starts the usual re-auth.
  useEffect(
    () =>
      onPlaybackFailed(() => {
        getMe().catch(() => {});
      }),
    [],
  );
}
