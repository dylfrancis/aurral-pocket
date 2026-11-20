import {
  getServerUrl,
  setAuthToken,
  setBaseUrl,
  setCustomHeaders,
} from "@/lib/api/client";
import { setSavedLibraryUser } from "@/lib/offline/saved-library";
import { startPlayHistory } from "@/lib/player/play-history";
import { AppStorage, INACTIVITY_RESET_MS, SecureStorage } from "@/lib/storage";

/**
 * The signed-in account, with the API client and saved music ready for it, or
 * null when signed out or the phone hasn't been unlocked since it started.
 * When Siri or a car wakes the app, no screen mounts the auth provider, so
 * this reads the session itself.
 */
export async function headlessSession(): Promise<{ userId: number } | null> {
  const [serverUrl, token, userJson, headers, lastActive] = await Promise.all([
    AppStorage.getServerUrl(),
    SecureStorage.getToken(),
    SecureStorage.getUser(),
    SecureStorage.getCustomHeaders(),
    SecureStorage.getLastActiveAt(),
  ]);
  if (!serverUrl || !token) return null;
  // The provider resets an account left this long, once a screen opens.
  if (lastActive && Date.now() - lastActive > INACTIVITY_RESET_MS) return null;
  const userId = userIdOf(userJson);
  if (userId === null) return null;

  if (!getServerUrl()) {
    setBaseUrl(serverUrl);
    setCustomHeaders(headers);
    setAuthToken(token);
    void SecureStorage.setLastActiveAt(Date.now());
    // No screen reports plays yet. The app layout's start replaces this one.
    startPlayHistory(userId);
  }
  await setSavedLibraryUser(userId);
  return { userId };
}

const clearedListeners = new Set<() => void>();

/**
 * Hear when the phone signs out, once the stored session is gone: read any
 * sooner, headlessSession would bring it back. Returns unsubscribe.
 */
export function onSessionCleared(listener: () => void): () => void {
  clearedListeners.add(listener);
  return () => {
    clearedListeners.delete(listener);
  };
}

/** Called by the auth provider once sign-out has deleted the session. */
export function sessionCleared(): void {
  clearedListeners.forEach((listener) => listener());
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
