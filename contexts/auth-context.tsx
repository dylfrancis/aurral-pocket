import { getMe } from "@/lib/api/auth";
import {
  notifyReAuthResult,
  setAuthToken,
  setBaseUrl,
  setCustomHeaders,
  setOnAccountSuspended,
  setOnAuthRefreshed,
  setOnSessionExpired,
} from "@/lib/api/client";
import { forgetDateTimeFormat, restoreDateTimeFormat } from "@/lib/date-time";
import { sessionCleared } from "@/lib/headless-session";
import { forgetPlayHistory } from "@/lib/player/play-history";
import { forgetQueue } from "@/lib/player/player";
import { forgetQueueSync } from "@/lib/player/queue-sync";
import { forgetAccount as forgetSiriAccount } from "@/modules/siri";
import { forgetAudioCache } from "@/lib/offline/audio-cache";
import { forgetSavedLibrary } from "@/lib/offline/saved-library";
import { AppStorage, INACTIVITY_RESET_MS, SecureStorage } from "@/lib/storage";
import type { HealthResponse, User } from "@/lib/types/auth";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ServerHealth = Pick<
  HealthResponse,
  "authRequired" | "onboardingRequired" | "oidcEnabled" | "oidcLogoutUrl"
>;

type AuthContextValue = {
  serverUrl: string | null;
  customHeaders: Record<string, string>;
  token: string | null;
  user: User | null;
  isRestoring: boolean;
  /**
   * True once the user object is as settled as startup can make it: restore
   * finished, and any server-side user recovery has completed or failed.
   * Screens whose structure depends on permissions (the tab bar) must wait
   * for this instead of `isRestoring`, or they render once with provisional
   * permissions and rebuild when the user arrives.
   */
  isUserResolved: boolean;
  serverHealth: ServerHealth | null;
  isOidcSession: boolean;
  /**
   * Provider logout URL waiting to be opened. Sign-out sets it;
   * `OidcLogoutWebView` clears it once the provider has been visited.
   */
  pendingOidcLogoutUrl: string | null;
  rememberCredentials: boolean;
  useBiometrics: boolean;
  sessionExpired: boolean;
  /**
   * The server refused a sign-in because the account is suspended or disabled.
   * Stays set after sign-out, until the user has read the message.
   */
  accountSuspended: boolean;
  setServer: (
    url: string,
    health: HealthResponse,
    customHeaders: Record<string, string>,
  ) => Promise<void>;
  saveCustomHeaders: (headers: Record<string, string>) => Promise<void>;
  setAuth: (token: string, user: User, expiresAt?: number) => Promise<void>;
  markOidcSession: (logoutUrl: string | null) => Promise<void>;
  requestOidcLogout: (logoutUrl: string) => void;
  finishOidcLogout: () => void;
  clearAuth: () => Promise<void>;
  clearAll: () => Promise<void>;
  setRememberCredentials: (value: boolean) => Promise<void>;
  setUseBiometrics: (value: boolean) => Promise<void>;
  saveCredentials: (username: string, password: string) => Promise<void>;
  updateExpiresAt: (expiresAt: number) => Promise<void>;
  dismissSessionExpired: () => void;
  setSessionExpired: (value: boolean) => void;
  markAccountSuspended: () => void;
  dismissAccountSuspended: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Stop the player and forget the queue, then the tracks fetched ahead of it.
 * In that order, so the engine isn't left playing a file that's just gone.
 * The server's copy of the queue stays for the account's other devices; the
 * sync stops first, so the emptied queue isn't sent there.
 */
function forgetPlayback(): Promise<void> {
  // Siri mustn't offer the next account this one's playlists and plays.
  forgetSiriAccount();
  return forgetQueueSync()
    .then(() => forgetQueue())
    .catch(() => {})
    .then(() => forgetAudioCache());
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [customHeaders, setCustomHeadersState] = useState<
    Record<string, string>
  >({});
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [isOidcSession, setIsOidcSession] = useState(false);
  const [pendingOidcLogoutUrl, setPendingOidcLogoutUrl] = useState<
    string | null
  >(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [rememberCreds, setRememberCreds] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [sessionExpired, setSessionExpiredState] = useState(false);
  const [accountSuspended, setAccountSuspended] = useState(false);
  const [userRecoveryAttempted, setUserRecoveryAttempted] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  // Restore persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const [
          storedUrl,
          storedToken,
          storedUserJson,
          remember,
          bio,
          creds,
          storedExpiry,
          lastActive,
          oidcSession,
          storedHeaders,
        ] = await Promise.all([
          AppStorage.getServerUrl(),
          SecureStorage.getToken(),
          SecureStorage.getUser(),
          SecureStorage.getRememberCredentials(),
          SecureStorage.getUseBiometrics(),
          SecureStorage.getCredentials(),
          SecureStorage.getExpiresAt(),
          SecureStorage.getLastActiveAt(),
          AppStorage.getOidcSession(),
          SecureStorage.getCustomHeaders(),
        ]);

        // Render the first frame with the server's format instead of the
        // device default, which bootstrap would otherwise correct a beat later.
        await restoreDateTimeFormat();

        // Hard expire after 30 days of inactivity with full reset to login screen
        if (lastActive && Date.now() - lastActive > INACTIVITY_RESET_MS) {
          forgetSiriAccount();
          await Promise.all([
            AppStorage.deleteServerUrl(),
            SecureStorage.deleteToken(),
            SecureStorage.deleteUser(),
            SecureStorage.deleteCredentials(),
            SecureStorage.deleteRememberCredentials(),
            SecureStorage.deleteUseBiometrics(),
            SecureStorage.deleteExpiresAt(),
            SecureStorage.deleteLastActiveAt(),
            SecureStorage.deleteCustomHeaders(),
            AppStorage.deleteOidcSession(),
            AppStorage.deletePlaybackQueue(),
            AppStorage.deleteQueueSync(),
            AppStorage.deletePlayEventOutbox(),
            forgetAudioCache(),
            forgetSavedLibrary(),
            forgetDateTimeFormat(),
          ]);
          return;
        }

        if (storedUrl) {
          setServerUrl(storedUrl);
          setBaseUrl(storedUrl);
          setCustomHeaders(storedHeaders);
          setCustomHeadersState(storedHeaders);
        }

        // An SSO session keeps no saved password. One beside it was left by an
        // older Sign Out on Session Expired, and a lost session would sign in
        // with it, as the account that saved it.
        const strayCreds = oidcSession && !!creds;
        if (strayCreds) {
          await Promise.all([
            SecureStorage.deleteCredentials(),
            SecureStorage.setRememberCredentials(false),
          ]);
        }
        const keptRemember = remember && !strayCreds;
        const keptCreds = strayCreds ? null : creds;

        if (storedToken) {
          setToken(storedToken);
          setAuthToken(storedToken);
          // Opening the app is activity. Otherwise a session that renews itself
          // is reset a month after its sign-in.
          void SecureStorage.setLastActiveAt(Date.now());
          // Saved before Siri, these kept the keychain's default, which a
          // locked phone can't read. Saving them again lets Siri use them.
          void SecureStorage.setToken(storedToken);
          if (storedUserJson) void SecureStorage.setUser(storedUserJson);
          if (Object.keys(storedHeaders).length > 0) {
            void SecureStorage.setCustomHeaders(storedHeaders);
          }
          // The same for what a 401 reads to sign in again silently, which a
          // locked phone playing music must read too.
          if (keptRemember) void SecureStorage.setRememberCredentials(true);
          if (bio) void SecureStorage.setUseBiometrics(true);
          if (keptRemember && keptCreds) {
            void SecureStorage.setCredentials(
              keptCreds.username,
              keptCreds.password,
              { whileLocked: true },
            );
          }
          if (storedExpiry) void SecureStorage.setExpiresAt(storedExpiry);
        }

        if (storedUserJson) {
          try {
            setUser(JSON.parse(storedUserJson));
          } catch {}
        }

        setRememberCreds(keptRemember);
        setBiometrics(bio);
        setIsOidcSession(oidcSession);
        if (storedExpiry) setExpiresAt(storedExpiry);
      } finally {
        setIsRestoring(false);
      }
    })();
  }, []);

  // A valid token paired with no cached user makes every permission check fail
  // closed — `useHasPermission` returns false when `user` is null — which
  // silently hides permission-gated UI (the Flow tab) from people who do have
  // access. `SecureStorage.getUser()` can come back absent, and the parse above
  // swallows corrupt JSON, so recover the user from the server rather than
  // trusting the cache. Deliberately outside the restore block: it must not
  // delay `isRestoring` and keep the splash screen up on every launch.
  // A user cached before API version 2 is refreshed too: it holds the old
  // `accessFlow` key, so its playlist checks would fail closed the same way.
  const rehydratedUser = useRef(false);
  useEffect(() => {
    if (isRestoring || rehydratedUser.current) return;
    if (!token) return;
    if (user?.permissions && "accessPlaylists" in user.permissions) return;
    rehydratedUser.current = true;
    (async () => {
      try {
        const me = await getMe();
        setUser(me.user);
        await SecureStorage.setUser(JSON.stringify(me.user));
      } catch {
        // Not fatal. A rejected token is already handled by the 401 interceptor,
        // and any other failure just leaves permissions conservative.
      } finally {
        setUserRecoveryAttempted(true);
      }
    })();
  }, [isRestoring, token, user]);

  // Wire up interceptor callbacks
  useEffect(() => {
    setOnSessionExpired(() => setSessionExpiredState(true));
    setOnAccountSuspended(() => setAccountSuspended(true));
    setOnAuthRefreshed((newToken, userJson, newExpiresAt) => {
      setToken(newToken);
      setAuthToken(newToken);
      setExpiresAt(newExpiresAt);
      try {
        setUser(JSON.parse(userJson));
      } catch {}
    });
    return () => {
      setOnSessionExpired(null);
      setOnAccountSuspended(null);
      setOnAuthRefreshed(null);
    };
  }, []);

  // Aurral moves a session's expiry forward as it's used, so the expiry saved
  // at sign-in falls behind. A minute before it, or at once on a launch
  // after it, the server says whether the session still stands. An answer
  // brings the new expiry. A refused session reaches the client's 401
  // handling, which signs in again silently or opens Session Expired.
  useEffect(() => {
    if (!expiresAt || !token) return;
    let cancelled = false;
    const delay = Math.max(0, expiresAt - Date.now() - 60_000);
    const timer = setTimeout(async () => {
      try {
        const me = await getMe();
        if (cancelled || !me.expiresAt) return;
        setExpiresAt(me.expiresAt);
        await SecureStorage.setExpiresAt(me.expiresAt);
      } catch {
        // Anything else, such as no connection, says nothing about the
        // session, so the next request finds out.
      }
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [expiresAt, token]);

  const setServer = useCallback(
    async (
      url: string,
      health: HealthResponse,
      headers: Record<string, string>,
    ) => {
      setServerUrl(url);
      setBaseUrl(url);
      setCustomHeaders(headers);
      setCustomHeadersState(headers);
      setServerHealth({
        authRequired: health.authRequired,
        onboardingRequired: health.onboardingRequired,
        oidcEnabled: health.oidcEnabled,
        oidcLogoutUrl: health.oidcLogoutUrl,
      });
      await Promise.all([
        AppStorage.setServerUrl(url),
        SecureStorage.setCustomHeaders(headers),
      ]);
    },
    [],
  );

  const saveCustomHeaders = useCallback(
    async (headers: Record<string, string>) => {
      setCustomHeaders(headers);
      setCustomHeadersState(headers);
      await SecureStorage.setCustomHeaders(headers);
    },
    [],
  );

  const setAuth = useCallback(
    async (newToken: string, newUser: User, newExpiresAt?: number) => {
      setToken(newToken);
      setUser(newUser);
      setAuthToken(newToken);
      if (newExpiresAt) setExpiresAt(newExpiresAt);
      const saves: Promise<void>[] = [
        SecureStorage.setToken(newToken),
        SecureStorage.setUser(JSON.stringify(newUser)),
        SecureStorage.setLastActiveAt(Date.now()),
      ];
      if (newExpiresAt) saves.push(SecureStorage.setExpiresAt(newExpiresAt));
      await Promise.all(saves);
    },
    [],
  );

  // An SSO session keeps no saved password. One from an earlier account
  // would sign this session's lost session back in as that account.
  const markOidcSession = useCallback(async (logoutUrl: string | null) => {
    setIsOidcSession(true);
    setRememberCreds(false);
    await Promise.all([
      AppStorage.setOidcSession(logoutUrl),
      SecureStorage.setRememberCredentials(false),
      SecureStorage.deleteCredentials(),
    ]);
  }, []);

  const requestOidcLogout = useCallback((logoutUrl: string) => {
    setPendingOidcLogoutUrl(logoutUrl);
  }, []);

  const finishOidcLogout = useCallback(() => {
    setPendingOidcLogoutUrl(null);
  }, []);

  const clearAuth = useCallback(async () => {
    setToken(null);
    setUser(null);
    setExpiresAt(null);
    setAuthToken(null);
    setIsOidcSession(false);
    // Signing out ends any re-auth in progress. A prompt left open would sit
    // over the login screen, and the requests waiting on it would never settle.
    setSessionExpiredState(false);
    notifyReAuthResult(false);
    await Promise.all([
      forgetPlayback(),
      SecureStorage.deleteToken(),
      SecureStorage.deleteUser(),
      SecureStorage.deleteExpiresAt(),
      AppStorage.deleteOidcSession(),
    ]);
    sessionCleared();
  }, []);

  const clearAll = useCallback(async () => {
    setServerUrl(null);
    setToken(null);
    setUser(null);
    setServerHealth(null);
    setBaseUrl("");
    setCustomHeaders({});
    setCustomHeadersState({});
    setAuthToken(null);
    setRememberCreds(false);
    setBiometrics(false);
    setIsOidcSession(false);
    await Promise.all([
      AppStorage.deleteServerUrl(),
      AppStorage.deleteOidcSession(),
      forgetPlayback(),
      forgetPlayHistory(),
      forgetSavedLibrary(),
      forgetDateTimeFormat(),
      SecureStorage.deleteToken(),
      SecureStorage.deleteUser(),
      SecureStorage.deleteCredentials(),
      SecureStorage.deleteRememberCredentials(),
      SecureStorage.deleteUseBiometrics(),
      SecureStorage.deleteExpiresAt(),
      SecureStorage.deleteLastActiveAt(),
      SecureStorage.deleteCustomHeaders(),
    ]);
    sessionCleared();
  }, []);

  const setRememberCredentials = useCallback(
    async (value: boolean) => {
      setRememberCreds(value);
      const writes: Promise<void>[] = [
        SecureStorage.setRememberCredentials(value),
      ];
      // Remember-me supersedes biometrics: when the user opts into silent
      // re-auth, turn off the Face ID gate so stored state stays consistent.
      if (value && biometrics) {
        setBiometrics(false);
        writes.push(SecureStorage.setUseBiometrics(false));
      }
      // If both remember and biometrics are off, clear stored credentials
      if (!value && !biometrics) {
        writes.push(SecureStorage.deleteCredentials());
      }
      await Promise.all(writes);
    },
    [biometrics],
  );

  const setUseBiometricsValue = useCallback(
    async (value: boolean) => {
      setBiometrics(value);
      await SecureStorage.setUseBiometrics(value);
      // If both remember and biometrics are off, clear stored credentials
      if (!value && !rememberCreds) {
        await SecureStorage.deleteCredentials();
      }
    },
    [rememberCreds],
  );

  const saveCredentials = useCallback(
    async (username: string, password: string) => {
      // Save if either remember or biometrics is enabled
      if (!rememberCreds && !biometrics) return;
      await SecureStorage.setCredentials(username, password, {
        whileLocked: rememberCreds,
      });
    },
    [rememberCreds, biometrics],
  );

  const updateExpiresAt = useCallback(async (newExpiresAt: number) => {
    setExpiresAt(newExpiresAt);
    await SecureStorage.setExpiresAt(newExpiresAt);
  }, []);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpiredState(false);
  }, []);

  const setSessionExpired = useCallback((value: boolean) => {
    setSessionExpiredState(value);
  }, []);

  const markAccountSuspended = useCallback(() => {
    setAccountSuspended(true);
  }, []);

  const dismissAccountSuspended = useCallback(() => {
    setAccountSuspended(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      serverUrl,
      customHeaders,
      token,
      user,
      isRestoring,
      isUserResolved:
        !isRestoring && (!token || !!user || userRecoveryAttempted),
      serverHealth,
      isOidcSession,
      pendingOidcLogoutUrl,
      rememberCredentials: rememberCreds,
      useBiometrics: biometrics,
      sessionExpired,
      accountSuspended,
      setServer,
      saveCustomHeaders,
      setAuth,
      markOidcSession,
      requestOidcLogout,
      finishOidcLogout,
      clearAuth,
      clearAll,
      setRememberCredentials,
      setUseBiometrics: setUseBiometricsValue,
      saveCredentials,
      updateExpiresAt,
      dismissSessionExpired,
      setSessionExpired,
      markAccountSuspended,
      dismissAccountSuspended,
    }),
    [
      serverUrl,
      customHeaders,
      token,
      user,
      isRestoring,
      userRecoveryAttempted,
      serverHealth,
      isOidcSession,
      pendingOidcLogoutUrl,
      rememberCreds,
      biometrics,
      sessionExpired,
      accountSuspended,
      setServer,
      saveCustomHeaders,
      setAuth,
      markOidcSession,
      requestOidcLogout,
      finishOidcLogout,
      clearAuth,
      clearAll,
      setRememberCredentials,
      setUseBiometricsValue,
      saveCredentials,
      updateExpiresAt,
      dismissSessionExpired,
      setSessionExpired,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
