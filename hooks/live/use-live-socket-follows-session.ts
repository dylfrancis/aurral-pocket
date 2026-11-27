import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useIsForeground } from "@/hooks/use-is-foreground";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  onLiveSocketRefused,
  openLiveSocket,
  resumeLiveSocket,
} from "@/lib/api/live-socket";
import { useGatewayUrl } from "@/lib/tailscale";

/**
 * Keeps one socket open for the signed-in session while the app is in the
 * foreground.
 */
export function useLiveSocketFollowsSession() {
  const { serverUrl, token, customHeaders } = useAuth();
  const foreground = useIsForeground();
  // Set when the app reaches the server through its own Tailscale node, and
  // follows the gateway to a new port.
  const gateway = useGatewayUrl(serverUrl);

  useEffect(() => {
    if (!serverUrl || !token || !foreground) return;
    return openLiveSocket({
      serverUrl: gateway ?? serverUrl,
      token,
      customHeaders,
    });
  }, [serverUrl, gateway, token, customHeaders, foreground]);

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
