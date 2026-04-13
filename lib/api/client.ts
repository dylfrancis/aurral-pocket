import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { SecureStorage } from "@/lib/storage";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

const api = axios.create({
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

let authToken: string | null = null;
let onSessionExpired: (() => void) | null = null;
let onAuthRefreshed:
  | ((token: string, userJson: string, expiresAt: number) => void)
  | null = null;
let reAuthPromise: Promise<boolean> | null = null;

export function setBaseUrl(url: string) {
  api.defaults.baseURL = url ? `${url}/api` : "";
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpired = cb;
}

export function setOnAuthRefreshed(
  cb: ((token: string, userJson: string, expiresAt: number) => void) | null,
) {
  onAuthRefreshed = cb;
}

async function isTokenLikelyExpired(): Promise<boolean> {
  // If we can't determine expiry (old install, fresh-restore edge cases),
  // fall back to the safe assumption that the token *could* be expired so
  // the iOS 401-swallow workaround still applies.
  const expiresAt = await SecureStorage.getExpiresAt();
  if (!expiresAt) return true;
  // Use the same 60s buffer as the proactive renewal timer — outside this
  // window the token is known-fresh and a timeout cannot be an iOS-swallowed 401.
  return Date.now() >= expiresAt - 60_000;
}

async function attemptSilentReAuth(): Promise<boolean> {
  try {
    const creds = await SecureStorage.getCredentials();
    if (!creds) return false;

    // Call login directly with a fresh axios instance to avoid interceptor recursion
    const { data } = await axios.post<{
      token: string;
      expiresAt: number;
      user: { id: number; username: string; role: string };
    }>(`${api.defaults.baseURL}/auth/login`, creds, {
      timeout: 10_000,
      headers: { "Content-Type": "application/json" },
    });

    authToken = data.token;
    const userJson = JSON.stringify(data.user);
    await Promise.all([
      SecureStorage.setToken(data.token),
      SecureStorage.setUser(userJson),
      SecureStorage.setExpiresAt(data.expiresAt),
    ]);
    onAuthRefreshed?.(data.token, userJson, data.expiresAt);
    return true;
  } catch {
    return false;
  }
}

async function handle401(
  originalRequest: InternalAxiosRequestConfig & { _retried?: boolean },
): Promise<ReturnType<typeof api> | void> {
  originalRequest._retried = true;

  // Deduplicate concurrent re-auth attempts
  if (!reAuthPromise) {
    const remember = await SecureStorage.getRememberCredentials();
    if (remember) {
      reAuthPromise = attemptSilentReAuth().finally(() => {
        reAuthPromise = null;
      });
    }
  }

  if (reAuthPromise) {
    const success = await reAuthPromise;
    if (success) {
      originalRequest.headers.Authorization = `Bearer ${authToken}`;
      return api(originalRequest);
    }
  }

  // Silent re-auth not available or failed — notify UI
  onSessionExpired?.();
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: string; message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };

    // iOS swallows 401 responses that include WWW-Authenticate: Basic headers.
    // NSURLSession intercepts them as authentication challenges and the response
    // never reaches JS — the request just times out. So a timeout on an
    // authenticated request *might* actually be an iOS-swallowed 401 — but only
    // if the token is already (near) expired. If the token is still known-fresh
    // by its stored expiresAt, a timeout is almost certainly a real network
    // issue (slow connection, slow upstream, etc.) and must not trigger the
    // session-expired flow. See: https://github.com/facebook/react-native/issues/34883
    if (
      !error.response &&
      authToken &&
      originalRequest &&
      !originalRequest._retried &&
      error.code === "ECONNABORTED" &&
      (await isTokenLikelyExpired())
    ) {
      const result = await handle401(originalRequest);
      if (result) return result;
      throw new ApiError(401, "Session expired");
    }

    if (!error.response) {
      throw new ApiError(0, "Unable to reach server. Check your connection.");
    }

    const { status, data } = error.response;

    // Handle real 401s (is there is ever iOS fix in place or on Android)
    if (status === 401 && originalRequest && !originalRequest._retried) {
      const result = await handle401(originalRequest);
      if (result) return result;
    }

    const msg = data?.error || data?.message || error.message;
    throw new ApiError(status, msg, data);
  },
);

export { api };
