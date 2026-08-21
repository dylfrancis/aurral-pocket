import type { OidcSession, User } from "@/lib/types/auth";

/**
 * OpenID Connect sign-in against an Aurral server.
 *
 * Aurral's flow is built for its own web frontend:
 *
 *   1. `GET /api/auth/oidc/login` sets an HttpOnly cookie, then redirects to
 *      the identity provider.
 *   2. The provider returns to `<server>/sso/callback`, the URI the server
 *      registers with it. Pocket registers nothing.
 *   3. The server checks the cookie, mints a single-use code good for 60
 *      seconds, and redirects to `<server>/sso/complete#code=...`.
 *   4. `POST /api/auth/oidc/exchange` trades the code for a session, and only
 *      accepts a request carrying the same cookie.
 *
 * Step 4 is why the whole flow runs in a WebView: the cookie belongs to the
 * browser that started step 1, so the app's HTTP client cannot make the
 * exchange. Pocket reads the code out of the step-3 redirect, blocks that page
 * from loading, and runs the exchange as a script inside the WebView. Blocking
 * the page also stops the web frontend spending the single-use code first.
 */

const LOGIN_PATH = "/api/auth/oidc/login";
const EXCHANGE_PATH = "/api/auth/oidc/exchange";

const COMPLETE_PATH = "/sso/complete";

export type OidcCompletion =
  { kind: "code"; code: string } | { kind: "error"; message: string };

export type OidcMessage =
  | { type: "session"; session: OidcSession }
  | { type: "error"; message: string };

/**
 * React Native's `URL` does not parse, so every helper here works on strings.
 * Switching to `URL` would pass under Jest, which has Node's real one, then
 * silently misread URLs on device.
 */
function originOf(url: string): string {
  const match = /^(https?:\/\/[^/?#]+)/i.exec(url.trim());
  return match ? match[1].toLowerCase() : "";
}

function pathOf(url: string): string {
  const trimmed = url.trim();
  const rest = trimmed.slice(originOf(trimmed).length);
  const path = rest.split(/[?#]/)[0];
  return path || "/";
}

function readParam(source: string, name: string): string | null {
  for (const pair of source.split("&")) {
    if (!pair) continue;
    const separator = pair.indexOf("=");
    const rawKey = separator === -1 ? pair : pair.slice(0, separator);
    if (decodeParam(rawKey) !== name) continue;
    return separator === -1 ? "" : decodeParam(pair.slice(separator + 1));
  }
  return null;
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function buildOidcLoginUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, "")}${LOGIN_PATH}`;
}

/**
 * A server-origin page to sit on while the exchange script runs. Its URL holds
 * no code, so the web frontend loaded there finds nothing to spend.
 */
export function buildOidcExchangePageUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, "")}${COMPLETE_PATH}`;
}

/**
 * True when the WebView is navigating to the end of the flow. Matches on origin
 * and path, not on the full server URL: the server's redirect is absolute-path,
 * so an Aurral hosted under a subpath lands on the host root.
 */
export function isOidcCompleteUrl(serverUrl: string, url: string): boolean {
  if (!serverUrl || !url) return false;
  if (originOf(url) !== originOf(serverUrl)) return false;
  return pathOf(url).replace(/\/+$/, "").endsWith(COMPLETE_PATH);
}

/** Aurral puts the outcome in the fragment; read the query too, for forks. */
export function readOidcCompletion(url: string): OidcCompletion | null {
  const hashAt = url.indexOf("#");
  const fragment = hashAt === -1 ? "" : url.slice(hashAt + 1);
  const queryAt = url.indexOf("?");
  const query =
    queryAt === -1
      ? ""
      : url.slice(queryAt + 1, hashAt === -1 ? undefined : hashAt);

  const code = readParam(fragment, "code") || readParam(query, "code");
  if (code) return { kind: "code", code };

  const error = readParam(fragment, "error") || readParam(query, "error");
  if (error) return { kind: "error", message: error };

  return null;
}

/** Runs the exchange inside the WebView, where the transaction cookie lives. */
export function buildOidcExchangeScript(code: string): string {
  return `(function () {
  var send = function (message) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    } catch (bridgeError) {}
  };
  try {
    fetch(${JSON.stringify(EXCHANGE_PATH)}, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ${JSON.stringify(code)} })
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var body = null;
          try {
            body = JSON.parse(text);
          } catch (parseError) {}
          return { ok: response.ok, body: body };
        });
      })
      .then(function (result) {
        if (result.ok && result.body) {
          send({ type: "session", session: result.body });
          return;
        }
        send({
          type: "error",
          message:
            (result.body && result.body.error) ||
            "Sign-in could not be completed."
        });
      })
      .catch(function () {
        send({ type: "error", message: "Unable to reach server." });
      });
  } catch (scriptError) {
    send({ type: "error", message: "Sign-in could not be completed." });
  }
})();
true;`;
}

function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "number" &&
    typeof user.username === "string" &&
    (user.role === "admin" || user.role === "user")
  );
}

/**
 * Any page in the WebView can reach the message bridge, so the payload is
 * untrusted: check its shape before it becomes a session. Callers check the
 * origin too.
 */
export function parseOidcMessage(raw: string): OidcMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const message = parsed as Record<string, unknown>;

  if (message.type === "error") {
    return {
      type: "error",
      message:
        typeof message.message === "string" && message.message
          ? message.message
          : "Sign-in could not be completed.",
    };
  }

  if (message.type !== "session") return null;
  const session = message.session as Record<string, unknown> | undefined;
  if (typeof session !== "object" || session === null) return null;
  if (typeof session.token !== "string" || !session.token) return null;
  if (typeof session.expiresAt !== "number") return null;
  if (!isUser(session.user)) return null;

  return {
    type: "session",
    session: {
      token: session.token,
      expiresAt: session.expiresAt,
      user: session.user,
    },
  };
}

export function isServerOrigin(serverUrl: string, url: string): boolean {
  if (!serverUrl || !url) return false;
  return originOf(url) === originOf(serverUrl);
}

/** Guards a URL that came from server configuration before the WebView opens it. */
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}
