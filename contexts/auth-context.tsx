import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  setAuthToken,
  setBaseUrl,
  setOnSessionExpired,
  setOnAuthRefreshed,
} from "@/lib/api/client";
import { login } from "@/lib/api/auth";
import { AppStorage, SecureStorage } from "@/lib/storage";
import type { HealthResponse, User } from "@/lib/types/auth";

type ServerHealth = Pick<HealthResponse, "authRequired" | "onboardingRequired">;

type AuthContextValue = {
  serverUrl: string | null;
  token: string | null;
  user: User | null;
  isRestoring: boolean;
  serverHealth: ServerHealth | null;
  rememberCredentials: boolean;
  useBiometrics: boolean;
  hasCredentials: boolean;
  sessionExpired: boolean;
  setServer: (url: string, health: HealthResponse) => Promise<void>;
  setAuth: (token: string, user: User, expiresAt?: number) => Promise<void>;
  clearAuth: () => Promise<void>;
  clearAll: () => Promise<void>;
  setRememberCredentials: (value: boolean) => Promise<void>;
  setUseBiometrics: (value: boolean) => Promise<void>;
  saveCredentials: (username: string, password: string) => Promise<void>;
  updateExpiresAt: (expiresAt: number) => Promise<void>;
  dismissSessionExpired: () => void;
  setSessionExpired: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [rememberCreds, setRememberCreds] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [sessionExpired, setSessionExpiredState] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        ] = await Promise.all([
          AppStorage.getServerUrl(),
          SecureStorage.getToken(),
          SecureStorage.getUser(),
          SecureStorage.getRememberCredentials(),
          SecureStorage.getUseBiometrics(),
          SecureStorage.getCredentials(),
          SecureStorage.getExpiresAt(),
          SecureStorage.getLastActiveAt(),
        ]);

        // Hard expire after 30 days of inactivity with full reset to login screen
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        if (lastActive && Date.now() - lastActive > THIRTY_DAYS_MS) {
          await Promise.all([
            AppStorage.deleteServerUrl(),
            SecureStorage.deleteToken(),
            SecureStorage.deleteUser(),
            SecureStorage.deleteCredentials(),
            SecureStorage.deleteRememberCredentials(),
            SecureStorage.deleteUseBiometrics(),
            SecureStorage.deleteExpiresAt(),
            SecureStorage.deleteLastActiveAt(),
          ]);
          return;
        }

        if (storedUrl) {
          setServerUrl(storedUrl);
          setBaseUrl(storedUrl);
        }

        if (storedToken) {
          setToken(storedToken);
          setAuthToken(storedToken);
        }

        if (storedUserJson) {
          try {
            setUser(JSON.parse(storedUserJson));
          } catch {}
        }

        setRememberCreds(remember);
        setBiometrics(bio);
        setHasCredentials(!!creds);
        if (storedExpiry) setExpiresAt(storedExpiry);
      } finally {
        setIsRestoring(false);
      }
    })();
  }, []);

  // Wire up interceptor callbacks
  useEffect(() => {
    setOnSessionExpired(() => setSessionExpiredState(true));
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
      setOnAuthRefreshed(null);
    };
  }, []);

  // Proactive session renewal — fires ~60s before token expires
  useEffect(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    if (!expiresAt || !token) return;

    const msUntilExpiry = expiresAt - Date.now();
    // Fire 60s before expiry, or immediately if already past
    const delay = Math.max(0, msUntilExpiry - 60_000);

    expiryTimer.current = setTimeout(async () => {
      // Try silent re-auth if remember is on
      const remember = await SecureStorage.getRememberCredentials();
      if (remember) {
        const creds = await SecureStorage.getCredentials();
        if (creds) {
          try {
            const data = await login(creds);
            setToken(data.token);
            setUser(data.user);
            setAuthToken(data.token);
            setExpiresAt(data.expiresAt);
            await Promise.all([
              SecureStorage.setToken(data.token),
              SecureStorage.setUser(JSON.stringify(data.user)),
              SecureStorage.setExpiresAt(data.expiresAt),
            ]);
            return;
          } catch {}
        }
      }
      // Silent re-auth unavailable or failed
      setSessionExpiredState(true);
    }, delay);

    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [expiresAt, token]);

  const setServer = useCallback(async (url: string, health: HealthResponse) => {
    setServerUrl(url);
    setBaseUrl(url);
    setServerHealth({
      authRequired: health.authRequired,
      onboardingRequired: health.onboardingRequired,
    });
    await AppStorage.setServerUrl(url);
  }, []);

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

  const clearAuth = useCallback(async () => {
    setToken(null);
    setUser(null);
    setExpiresAt(null);
    setAuthToken(null);
    await Promise.all([
      SecureStorage.deleteToken(),
      SecureStorage.deleteUser(),
      SecureStorage.deleteExpiresAt(),
    ]);
  }, []);

  const clearAll = useCallback(async () => {
    setServerUrl(null);
    setToken(null);
    setUser(null);
    setServerHealth(null);
    setBaseUrl("");
    setAuthToken(null);
    setRememberCreds(false);
    setBiometrics(false);
    setHasCredentials(false);
    await Promise.all([
      AppStorage.deleteServerUrl(),
      SecureStorage.deleteToken(),
      SecureStorage.deleteUser(),
      SecureStorage.deleteCredentials(),
      SecureStorage.deleteRememberCredentials(),
      SecureStorage.deleteUseBiometrics(),
      SecureStorage.deleteExpiresAt(),
      SecureStorage.deleteLastActiveAt(),
    ]);
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
        setHasCredentials(false);
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
        setHasCredentials(false);
        await SecureStorage.deleteCredentials();
      }
    },
    [rememberCreds],
  );

  const saveCredentials = useCallback(
    async (username: string, password: string) => {
      // Save if either remember or biometrics is enabled
      if (!rememberCreds && !biometrics) return;
      setHasCredentials(true);
      await SecureStorage.setCredentials(username, password);
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

  const value = useMemo<AuthContextValue>(
    () => ({
      serverUrl,
      token,
      user,
      isRestoring,
      serverHealth,
      rememberCredentials: rememberCreds,
      useBiometrics: biometrics,
      hasCredentials,
      sessionExpired,
      setServer,
      setAuth,
      clearAuth,
      clearAll,
      setRememberCredentials,
      setUseBiometrics: setUseBiometricsValue,
      saveCredentials,
      updateExpiresAt,
      dismissSessionExpired,
      setSessionExpired,
    }),
    [
      serverUrl,
      token,
      user,
      isRestoring,
      serverHealth,
      rememberCreds,
      biometrics,
      hasCredentials,
      sessionExpired,
      setServer,
      setAuth,
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
