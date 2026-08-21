import {
  buildOidcExchangePageUrl,
  buildOidcExchangeScript,
  buildOidcLoginUrl,
  isHttpUrl,
  isOidcCompleteUrl,
  isServerOrigin,
  parseOidcMessage,
  readOidcCompletion,
} from "@/lib/oidc";
const SERVER = "https://aurral.example.com";

const USER = { id: 7, username: "ada", role: "user" as const, permissions: {} };

describe("buildOidcLoginUrl", () => {
  it("points at the server's OIDC login route", () => {
    expect(buildOidcLoginUrl(SERVER)).toBe(
      "https://aurral.example.com/api/auth/oidc/login",
    );
  });

  it("does not double the slash when the server URL has a trailing one", () => {
    expect(buildOidcLoginUrl(`${SERVER}/`)).toBe(
      "https://aurral.example.com/api/auth/oidc/login",
    );
  });
});

describe("buildOidcExchangePageUrl", () => {
  it("stays on the server origin and carries no code", () => {
    const url = buildOidcExchangePageUrl(SERVER);
    expect(url).toBe("https://aurral.example.com/sso/complete");
    expect(url).not.toContain("code");
  });
});

describe("isOidcCompleteUrl", () => {
  it("matches the completion redirect", () => {
    expect(isOidcCompleteUrl(SERVER, `${SERVER}/sso/complete#code=abc`)).toBe(
      true,
    );
  });

  it("matches when the server URL carries a subpath the redirect drops", () => {
    expect(
      isOidcCompleteUrl(`${SERVER}/aurral`, `${SERVER}/sso/complete#code=abc`),
    ).toBe(true);
  });

  it("ignores the identity provider's own pages", () => {
    expect(
      isOidcCompleteUrl(SERVER, "https://idp.example.com/authorize?state=1"),
    ).toBe(false);
  });

  it("ignores another host that uses the same path", () => {
    expect(
      isOidcCompleteUrl(SERVER, "https://evil.example.com/sso/complete#code=x"),
    ).toBe(false);
  });

  it("ignores other pages on the server", () => {
    expect(isOidcCompleteUrl(SERVER, `${SERVER}/sso/callback?code=x`)).toBe(
      false,
    );
  });
});

describe("readOidcCompletion", () => {
  it("reads the code out of the fragment", () => {
    expect(readOidcCompletion(`${SERVER}/sso/complete#code=abc123`)).toEqual({
      kind: "code",
      code: "abc123",
    });
  });

  it("decodes a percent-encoded code", () => {
    expect(readOidcCompletion(`${SERVER}/sso/complete#code=a%2Fb`)).toEqual({
      kind: "code",
      code: "a/b",
    });
  });

  it("reads the error out of the fragment", () => {
    expect(
      readOidcCompletion(
        `${SERVER}/sso/complete#error=OIDC%20login%20session%20expired`,
      ),
    ).toEqual({ kind: "error", message: "OIDC login session expired" });
  });

  it("reads the query too, for a fork that uses it", () => {
    expect(readOidcCompletion(`${SERVER}/sso/complete?code=abc`)).toEqual({
      kind: "code",
      code: "abc",
    });
  });

  it("returns null when the redirect carries neither", () => {
    expect(readOidcCompletion(`${SERVER}/sso/complete`)).toBeNull();
  });
});

describe("buildOidcExchangeScript", () => {
  it("posts the code to the exchange route from inside the page", () => {
    const script = buildOidcExchangeScript("abc123");
    expect(script).toContain("/api/auth/oidc/exchange");
    expect(script).toContain('"abc123"');
    // Same-origin request, so the transaction cookie goes with it.
    expect(script).toContain('credentials: "include"');
    // iOS warns when an injected script does not end with a value.
    expect(script.trimEnd().endsWith("true;")).toBe(true);
  });

  it("escapes a code that would otherwise break out of the script", () => {
    const script = buildOidcExchangeScript('a"); alert(1); //');
    expect(script).toContain('"a\\"); alert(1); //"');
  });
});

describe("parseOidcMessage", () => {
  it("accepts a well-formed session", () => {
    const raw = JSON.stringify({
      type: "session",
      session: { token: "t0ken", expiresAt: 1700, user: USER },
    });
    expect(parseOidcMessage(raw)).toEqual({
      type: "session",
      session: { token: "t0ken", expiresAt: 1700, user: USER },
    });
  });

  it("accepts an error message", () => {
    const raw = JSON.stringify({ type: "error", message: "Nope" });
    expect(parseOidcMessage(raw)).toEqual({ type: "error", message: "Nope" });
  });

  it("falls back to a generic message when the error text is missing", () => {
    expect(parseOidcMessage(JSON.stringify({ type: "error" }))).toEqual({
      type: "error",
      message: "Sign-in could not be completed.",
    });
  });

  it("rejects a session with no token", () => {
    const raw = JSON.stringify({
      type: "session",
      session: { expiresAt: 1700, user: USER },
    });
    expect(parseOidcMessage(raw)).toBeNull();
  });

  it("rejects a session whose user is the wrong shape", () => {
    const raw = JSON.stringify({
      type: "session",
      session: { token: "t", expiresAt: 1, user: { id: "seven" } },
    });
    expect(parseOidcMessage(raw)).toBeNull();
  });

  it("rejects an unknown message type", () => {
    expect(parseOidcMessage(JSON.stringify({ type: "hello" }))).toBeNull();
  });

  it("rejects text that is not JSON", () => {
    expect(parseOidcMessage("not json")).toBeNull();
  });
});

describe("isServerOrigin", () => {
  it("accepts the server's own origin", () => {
    expect(isServerOrigin(SERVER, `${SERVER}/sso/complete`)).toBe(true);
  });

  it("rejects any other origin", () => {
    expect(isServerOrigin(SERVER, "https://idp.example.com/x")).toBe(false);
  });

  it("rejects an empty URL", () => {
    expect(isServerOrigin(SERVER, "")).toBe(false);
  });
});

describe("isHttpUrl", () => {
  it("accepts http and https", () => {
    expect(isHttpUrl("http://idp.example.com/logout")).toBe(true);
    expect(isHttpUrl("https://idp.example.com/logout")).toBe(true);
  });

  it("rejects any other scheme, since the value comes from server config", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});

// The cases above use an https host, but a self-hosted Aurral is often plain
// http on a LAN address. Captured from a live Aurral 2.2.0 run.
describe("against a real server's URLs", () => {
  const LAN = "http://192.168.4.36:3001";
  const REDIRECT = `${LAN}/sso/complete#code=LrWCGJ7VtU-DrGWM1ES9YsGn_rpDLitQJ9HO6x-98TA`;

  it("recognises the redirect over plain http", () => {
    expect(isOidcCompleteUrl(LAN, REDIRECT)).toBe(true);
  });

  it("reads a base64url code without mangling its dashes", () => {
    expect(readOidcCompletion(REDIRECT)).toEqual({
      kind: "code",
      code: "LrWCGJ7VtU-DrGWM1ES9YsGn_rpDLitQJ9HO6x-98TA",
    });
  });

  it("tells the server apart from a provider on another port", () => {
    expect(isServerOrigin(LAN, REDIRECT)).toBe(true);
    expect(
      isServerOrigin(LAN, "http://192.168.4.36:8080/default/authorize"),
    ).toBe(false);
  });

  it("accepts the session body the exchange actually returns", () => {
    const session = {
      token: "b8cb04ef07ec7dd81c9576692ae702bb8787780fed597e136f7de21706351760",
      expiresAt: 1789867831414,
      user: {
        id: 2,
        username: "ada",
        role: "admin",
        permissions: { accessSettings: true, accessFlow: true },
      },
    };
    expect(
      parseOidcMessage(JSON.stringify({ type: "session", session })),
    ).toEqual({ type: "session", session });
  });
});
