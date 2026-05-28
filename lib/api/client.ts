import { SecureStorage } from "@/lib/storage";
import { fetch } from "expo/fetch";

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

export function absolutizeImageUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  if (raw.startsWith("/")) {
    const origin = baseURL.replace(/\/api\/?$/, "");
    return origin ? `${origin}${raw}` : raw;
  }
  return raw.replace(/^http:\/\//, "https://");
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

  // Skip the session-expired flow for /auth/login itself — a 401 here means
  // the user typed the wrong password, not that an existing session expired.
  // Letting it through would pop the re-auth modal on top of the login screen
  // with no user context, and the Continue button would no-op.
  if (response.status === 401 && !config._retried && path !== "/auth/login") {
    const retried = await handle401<T>(method, path, body, config);
    if (retried) return retried;
    throw new ApiError(401, "Session expired");
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  let jsonParseFailed = false;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      jsonParseFailed = true;
    }
  }

  if (!response.ok) {
    const errorBody =
      typeof parsed === "object" && parsed !== null
        ? (parsed as { error?: string; message?: string })
        : undefined;
    const msg = errorBody?.error || errorBody?.message || response.statusText;
    throw new ApiError(response.status, msg, parsed ?? text);
  }

  // 200 with a non-JSON body almost always means a reverse proxy (Cloudflare
  // challenge page, Nginx error page, captive portal) intercepted the request.
  // Surface it as an error instead of letting `undefined as T` flow downstream.
  if (jsonParseFailed) {
    throw new ApiError(
      response.status,
      diagnoseUnexpectedResponse(text, response.headers),
      text,
    );
  }

  return { data: parsed as T, status: response.status };
}

// Cloudflare's Bot Fight Mode / Browser Integrity Check / Managed Challenge
// returns a 200 + HTML challenge page to non-browser clients by default —
// breaking mobile apps while the web UI continues to work because browsers
// pass the JS challenge invisibly. Cloudflare's own docs confirm SBFM blocks
// tunnel traffic unless reconfigured, and Nextcloud's support forum reports
// the same failure mode for their mobile app. Identifying the cause in the
// error message saves the user from a forty-tab debugging session.
//
// Refs:
//   https://developers.cloudflare.com/bots/get-started/super-bot-fight-mode/
//   https://help.nextcloud.com/t/cloudflare-dns-proxy-breaks-mobile-app-login-flow-specifically/227409/2
function diagnoseUnexpectedResponse(
  text: string,
  headers: { get(name: string): string | null },
): string {
  const isCloudflare =
    !!headers.get("cf-ray") ||
    (headers.get("server")?.toLowerCase().includes("cloudflare") ?? false) ||
    /\bcloudflare\b/i.test(text);

  if (isCloudflare) {
    const isChallenge =
      /just a moment|attention required|checking your browser|managed[_ -]challenge|cf-?chl|turnstile/i.test(
        text,
      );
    if (isChallenge) {
      return "Cloudflare is challenging the request. In your Cloudflare dashboard, disable Bot Fight Mode or add a WAF Skip rule for /api/*.";
    }
    return "Blocked by Cloudflare. Check Security → Events in your Cloudflare dashboard for the rule that fired.";
  }

  return "Server returned a non-JSON response. Check your reverse proxy logs.";
}

export const api = {
  get: <T>(path: string, config?: RequestConfig) =>
    request<T>("GET", path, undefined, config),
  post: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>("POST", path, body, config),
  put: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>("PUT", path, body, config),
  patch: <T>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>("PATCH", path, body, config),
  delete: <T>(path: string, config?: RequestConfig) =>
    request<T>("DELETE", path, undefined, config),
  get defaults() {
    return { baseURL };
  },
};
