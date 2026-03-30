import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { setAuthToken, setBaseUrl } from '@/lib/api/client';
import { AppStorage, SecureStorage } from '@/lib/storage';
import type { HealthResponse, User } from '@/lib/types';

type ServerHealth = Pick<HealthResponse, 'authRequired' | 'onboardingRequired'>;

type AuthContextValue = {
  serverUrl: string | null;
  token: string | null;
  user: User | null;
  isRestoring: boolean;
  serverHealth: ServerHealth | null;
  setServer: (url: string, health: HealthResponse) => Promise<void>;
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  clearAll: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Restore persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedUrl, storedToken, storedUserJson] = await Promise.all([
          AppStorage.getServerUrl(),
          SecureStorage.getToken(),
          SecureStorage.getUser(),
        ]);

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
      } finally {
        setIsRestoring(false);
      }
    })();
  }, []);

  const setServer = useCallback(
    async (url: string, health: HealthResponse) => {
      setServerUrl(url);
      setBaseUrl(url);
      setServerHealth({
        authRequired: health.authRequired,
        onboardingRequired: health.onboardingRequired,
      });
      await AppStorage.setServerUrl(url);
    },
    [],
  );

  const setAuth = useCallback(async (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setAuthToken(newToken);
    await Promise.all([
      SecureStorage.setToken(newToken),
      SecureStorage.setUser(JSON.stringify(newUser)),
    ]);
  }, []);

  const clearAuth = useCallback(async () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    await Promise.all([SecureStorage.deleteToken(), SecureStorage.deleteUser()]);
  }, []);

  const clearAll = useCallback(async () => {
    setServerUrl(null);
    setToken(null);
    setUser(null);
    setServerHealth(null);
    setBaseUrl('');
    setAuthToken(null);
    await Promise.all([
      AppStorage.deleteServerUrl(),
      SecureStorage.deleteToken(),
      SecureStorage.deleteUser(),
    ]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      serverUrl,
      token,
      user,
      isRestoring,
      serverHealth,
      setServer,
      setAuth,
      clearAuth,
      clearAll,
    }),
    [
      serverUrl,
      token,
      user,
      isRestoring,
      serverHealth,
      setServer,
      setAuth,
      clearAuth,
      clearAll,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
