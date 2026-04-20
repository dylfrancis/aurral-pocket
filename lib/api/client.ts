import { fetch } from "expo/fetch";
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

type RequestConfig = {
  params?: Record<string, unknown>;
  signal?: AbortSignal;
  /** Per-request timeout in ms; defaults to `defaultTimeoutMs`. */
  timeout?: number;
  _retried?: boolean;
};

type ApiResponse<T> = { data: T; status: number };

let baseURL = "";
let authToken: string | null = null;
let onSessionExpired: (() => void) | null = null;
let onAuthRefreshed:
  | ((token: string, userJson: string, expiresAt: number) => void)
  | null = null;
let reAuthPromise: Promise<boolean> | null = null;
let resolveModalReAuth: ((success: boolean) => void) | null = null;
const defaultTimeoutMs = 60_000;

export function setBaseUrl(url: string) {
  baseURL = url ? `${url}/api` : "";
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

/**
 * Resolve the pending re-auth promise when the user finishes (or abandons)
 * the session-expired modal. Requests paused on the 401 will retry on
 * success = true, or reject with 401 on success = false.
 */
export function notifyReAuthResult(success: boolean) {
  resolveModalReAuth?.(success);
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const root = path.startsWith("http") ? path : `${baseURL}${path}`;
  if (!params) return root;
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return root;
  const qs = entries
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
  return `${root}${root.includes("?") ? "&" : "?"}${qs}`;
}

async function attemptSilentReAuth(): Promise<boolean> {
  try {
    const creds = await SecureStorage.getCredentials();
    if (!creds) return false;

    const response = await fetch(`${baseURL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as {
      token: string;
      expiresAt: number;
      user: { id: number; username: string; role: string };
    };

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

async function handle401<T>(
  method: string,
  path: string,
  body: unknown,
  config: RequestConfig,
): Promise<ApiResponse<T> | null> {
  if (!reAuthPromise) {
    reAuthPromise = (async () => {
      const remember = await SecureStorage.getRememberCredentials();
      if (remember && (await attemptSilentReAuth())) return true;
      // Silent path unavailable or failed — open the modal and wait for the
      // user to finish re-auth (password or Face ID → setAuth → notify).
      const modalPromise = new Promise<boolean>((resolve) => {
        resolveModalReAuth = resolve;
      });
      onSessionExpired?.();
      return modalPromise;
    })().finally(() => {
      reAuthPromise = null;
      resolveModalReAuth = null;
    });
  }

  const success = await reAuthPromise;
  if (success) {
    return request<T>(method, path, body, { ...config, _retried: true });
  }
  return null;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  config: RequestConfig = {},
): Promise<ApiResponse<T>> {
  const url = buildUrl(path, config.params);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const timeoutController = new AbortController();
  const timeoutMs = config.timeout ?? defaultTimeoutMs;
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Chain the caller's signal with our timeout controller
  const callerSignal = config.signal;
  if (callerSignal) {
    if (callerSignal.aborted) timeoutController.abort();
    else
      callerSignal.addEventListener("abort", () => timeoutController.abort(), {
        once: true,
      });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    });
  } catch {
    clearTimeout(timeoutId);
    throw new ApiError(0, "Unable to reach server. Check your connection.");
  }
  clearTimeout(timeoutId);

  if (response.status === 401 && !config._retried) {
    const retried = await handle401<T>(method, path, body, config);
    if (retried) return retried;
    throw new ApiError(401, "Session expired");
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const body =
      typeof parsed === "object" && parsed !== null
        ? (parsed as { error?: string; message?: string })
        : undefined;
    const msg = body?.error || body?.message || response.statusText;
    throw new ApiError(response.status, msg, parsed);
  }

  return { data: parsed as T, status: response.status };
}

export const api = {
  get: <T>(path: string, config?: RequestConfig) =>
    request<T>("GET", path, undefined, config),
  post: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>("POST", path, body, config),
  put: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>("PUT", path, body, config),
  delete: <T>(path: string, config?: RequestConfig) =>
    request<T>("DELETE", path, undefined, config),
  get defaults() {
    return { baseURL };
  },
};
