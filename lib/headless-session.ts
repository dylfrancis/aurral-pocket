import {
  getServerUrl,
  setAuthToken,
  setBaseUrl,
  setCustomHeaders,
} from "@/lib/api/client";
import { setSavedLibraryUser } from "@/lib/offline/saved-library";
import { startPlayHistory } from "@/lib/player/play-history";
import { AppStorage, INACTIVITY_RESET_MS, SecureStorage } from "@/lib/storage";
import type { TailscaleSettings } from "@/lib/types/tailscale";
import { isTailscaleAvailable, startGateway } from "@/lib/tailscale";

/**
 * The signed-in account, with the API client and saved music ready for it, or
 * null when signed out or the phone hasn't been unlocked since it started.
 * When Siri or a car wakes the app, no screen mounts the auth provider, so
 * this reads the session itself.
 */
export async function headlessSession(): Promise<{ userId: number } | null> {
  const [serverUrl, token, userJson, headers, lastActive, tailscale] =
    await Promise.all([
      AppStorage.getServerUrl(),
      SecureStorage.getToken(),
      SecureStorage.getUser(),
      SecureStorage.getCustomHeaders(),
      SecureStorage.getLastActiveAt(),
      AppStorage.getTailscale(),
    ]);
  if (!serverUrl || !token) return null;
  // The provider resets an account left this long, once a screen opens.
  if (lastActive && Date.now() - lastActive > INACTIVITY_RESET_MS) return null;
  const userId = userIdOf(userJson);
  if (userId === null) return null;

  // Before the check, so two wakes can't both pass it while the gateway starts.
  const baseUrl = await gatewayOrServer(serverUrl, tailscale);
  if (!getServerUrl()) {
    setBaseUrl(baseUrl);
    setCustomHeaders(headers);
    setAuthToken(token);
    void SecureStorage.setLastActiveAt(Date.now());
    // No screen reports plays yet. The app layout's start replaces this one.
    startPlayHistory(userId);
  }
  await setSavedLibraryUser(userId);
  return { userId };
}

/**
 * The gateway, for a server reached through the app's own Tailscale node. If
 * it won't start, the server itself, which works only on the tailnet.
 */
async function gatewayOrServer(
  serverUrl: string,
  tailscale: TailscaleSettings | null,
): Promise<string> {
  if (!tailscale || !isTailscaleAvailable) return serverUrl;
  try {
    return await startGateway(serverUrl, tailscale);
  } catch {
    return serverUrl;
  }
}

/** What the auth provider just stored. */
export type SessionChange = "signedIn" | "renewed" | "signedOut";

const changeListeners = new Set<(change: SessionChange) => void>();

/**
 * Hear when the phone signs in, renews its token or signs out, once storage
 * holds the change: read any sooner, headlessSession would find the old
 * session. Returns unsubscribe.
 */
export function onSessionChanged(
  listener: (change: SessionChange) => void,
): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/**
 * Called by the auth provider once a change is stored. A listener that throws
 * is skipped, so it can't fail the sign-in or sign-out.
 */
export function sessionChanged(change: SessionChange): void {
  changeListeners.forEach((listener) => {
    try {
      listener(change);
    } catch {}
  });
}

function userIdOf(userJson: string | null): number | null {
  if (!userJson) return null;
  try {
    const user: unknown = JSON.parse(userJson);
    const id = (user as { id?: unknown } | null)?.id;
    return typeof id === "number" ? id : null;
  } catch {
    return null;
  }
}
