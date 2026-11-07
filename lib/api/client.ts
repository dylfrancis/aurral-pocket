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

  /** The session is valid, but signed in too long ago for this route. */
  get isReauthRequired() {
    return this.status === 401 && this.errorLabel === "reauth_required";
  }

  /** `/auth/reauth` refused an account that only signs in with SSO. */
  get isNoLocalPassword() {
    return this.status === 400 && this.errorLabel === "no_local_password";
  }

  private get errorLabel() {
    return typeof this.body === "object" && this.body !== null
      ? (this.body as { error?: unknown }).error
      : undefined;
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
  ((token: string, userJson: string, expiresAt: number) => void) | null = null;
let reAuthPromise: Promise<boolean> | null = null;
let resolveModalReAuth: ((success: boolean) => void) | null = null;
const defaultTimeoutMs = 60_000;

export function setBaseUrl(url: string) {
  baseURL = url ? `${url}/api` : "";
}

export function absolutizeServerPath(urlOrPath: string): string {
  if (!urlOrPath.startsWith("/")) return urlOrPath;
  return `${baseURL.replace(/\/api\/?$/, "")}${urlOrPath}`;
}

export function absolutizeImageUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  if (raw.startsWith("/")) return absolutizeServerPath(raw);
  return raw.replace(/^http:\/\//, "https://");
}

export type ServerImageSource = {
  uri: string;
  headers?: Record<string, string>;
};

/**
 * An expo-image source for artwork the Aurral server serves, such as an
 * album's `coverUrl`. The token goes in a header, not the URL, because the
 * URL is expo-image's cache key. Only a server-relative path gets it, so the
 * token never reaches another host.
 */
export function serverImageSource(
  raw: string | null | undefined,
): ServerImageSource | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return { uri: absolutizeImageUrl(raw)! };
  if (!baseURL) return null;
  const uri = absolutizeImageUrl(raw)!;
  return authToken
    ? { uri, headers: { Authorization: `Bearer ${authToken}` } }
    : { uri };
}

/**
 * An artwork URL that authenticates itself, for a reader that cannot send
 * headers: the engine fetches the lock screen's image with a plain request.
 * Aurral accepts the token on its artwork routes. Anything that shows the image
 * in the app should use serverImageSource, which keeps the token out of the
 * cache key. Only a server-relative path gets the token.
 */
export function authenticatedImageUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return absolutizeImageUrl(raw);
  if (!authToken || !baseURL) return null;
  return buildUrl(absolutizeImageUrl(raw)!, { token: authToken });
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

/**
 * Build an absolute URL that authenticates itself. The audio engine plays a
 * URL and cannot attach an Authorization header, so the session token travels
 * in the query string — the same way the Aurral web player streams. Returns
 * null when the token or the server address is missing, so a caller never
 * hands the engine a URL the server answers with 401.
 */
export function buildAuthenticatedUrl(path: string): string | null {
  if (!authToken || !baseURL) return null;
  return buildUrl(path, { token: authToken });
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

/**
 * Whether a 401 means the session is gone, so signing in again can recover the
 * request. Three don't:
 *
 * - `/auth/login` means a wrong password. Going on would pop the re-auth modal
 *   over the login screen, with no user and a Continue button that does nothing.
 * - `/auth/logout` means the session has already ended, which is what the
 *   caller wanted. A password change deletes it just before this call.
 * - `reauth_required` means the session is fine but not recent. The caller
 *   confirms the password with `/auth/reauth` instead.
 */
function isLostSession(error: ApiError, path: string) {
  return (
    error.status === 401 &&
    path !== "/auth/login" &&
    path !== "/auth/logout" &&
    !error.isReauthRequired
  );
}

async function handle401<T>(
  method: string,
  path: string,
  body: unknown,
  config: RequestConfig,
): Promise<ApiResponse<T> | null> {
  // An answer that arrived after sign-out has no session to recover.
  if (!authToken) return null;

  if (!reAuthPromise) {
    reAuthPromise = (async () => {
      const remember = await SecureStorage.getRememberCredentials();
      if (remember && (await attemptSilentReAuth())) return true;
      if (!authToken) return false;
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
    // Aurral puts the detail in `message` and a short label or code in
    // `error`: a validation failure is `{ error: "Invalid request", message }`.
    // Codes such as `reauth_required` stay readable on `body`.
    const msg = errorBody?.message || errorBody?.error || response.statusText;
    const error = new ApiError(response.status, msg, parsed ?? text);
    if (isLostSession(error, path) && !config._retried) {
      const retried = await handle401<T>(method, path, body, config);
      if (retried) return retried;
      throw new ApiError(401, "Session expired");
    }
    throw error;
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
