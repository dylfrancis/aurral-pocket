jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("expo/fetch", () => ({
  fetch: jest.fn(),
}));

import { fetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import {
  ApiError,
  api,
  setAuthToken,
  setBaseUrl,
  setOnSessionExpired,
  setOnAuthRefreshed,
  notifyReAuthResult,
} from "@/lib/api/client";

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

function mockResponse(init: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
}): any {
  const { ok = true, status = 200, statusText = "OK", body = {} } = init;
  const text =
    typeof body === "string"
      ? body
      : body === undefined
        ? ""
        : JSON.stringify(body);
  return {
    ok,
    status,
    statusText,
    text: () => Promise.resolve(text),
    json: () =>
      Promise.resolve(typeof body === "string" ? JSON.parse(body) : body),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockSecureStore.getItemAsync.mockReset();
  mockSecureStore.setItemAsync.mockReset();
  setAuthToken(null);
  setOnSessionExpired(null);
  setOnAuthRefreshed(null);
  setBaseUrl("https://test.example");
});

describe("ApiError", () => {
  it("has correct properties", () => {
    const error = new ApiError(401, "Unauthorized", { detail: "bad token" });
    expect(error.status).toBe(401);
    expect(error.message).toBe("Unauthorized");
    expect(error.body).toEqual({ detail: "bad token" });
    expect(error.isNetworkError).toBe(false);
    expect(error.name).toBe("ApiError");
    expect(error).toBeInstanceOf(Error);
  });

  it("identifies network errors with status 0", () => {
    expect(new ApiError(0, "Network error").isNetworkError).toBe(true);
  });

  it("non-network errors return false", () => {
    expect(new ApiError(500, "Server error").isNetworkError).toBe(false);
  });
});

describe("setBaseUrl", () => {
  afterEach(() => setBaseUrl(""));

  it("sets baseURL with /api suffix", () => {
    setBaseUrl("https://example.com");
    expect(api.defaults.baseURL).toBe("https://example.com/api");
  });

  it("clears baseURL when given empty string", () => {
    setBaseUrl("");
    expect(api.defaults.baseURL).toBe("");
  });
});

describe("auth token on outgoing requests", () => {
  it("attaches Bearer token to requests when set", async () => {
    setAuthToken("test-token-123");
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    await api.get("/ping");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0][1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token-123",
    );
  });

  it("does not attach Authorization when token is null", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    await api.get("/ping");

    const init = mockFetch.mock.calls[0][1] as RequestInit | undefined;
    expect(
      (init?.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });
});

describe("query params", () => {
  it("serializes params onto the URL", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] }));

    await api.get("/search", { params: { q: "the smiths", limit: 10 } });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe("https://test.example/api/search?q=the%20smiths&limit=10");
  });

  it("omits nullish params", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ body: [] }));

    await api.get("/search", { params: { q: "hi", cursor: undefined } });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe("https://test.example/api/search?q=hi");
  });
});

describe("response parsing", () => {
  it("returns parsed JSON body in response.data", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ body: { name: "Radiohead" } }),
    );

    const res = await api.get<{ name: string }>("/artist");
    expect(res.data).toEqual({ name: "Radiohead" });
    expect(res.status).toBe(200);
  });

  it("throws ApiError with status + message for 5xx", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 500,
        statusText: "Server Error",
        body: { error: "boom" },
      }),
    );

    await expect(api.get("/breaks")).rejects.toMatchObject({
      status: 500,
      message: "boom",
    });
  });

  it("throws network ApiError when fetch rejects", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("network down"));

    await expect(api.get("/anything")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("Unable to reach server"),
    });
  });
});

describe("401 handling", () => {
  it("opens the re-auth modal and throws 401 when the user dismisses it", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 401,
        body: { error: "no" },
      }),
    );
    const onExpired = jest.fn(() => notifyReAuthResult(false));
    setOnSessionExpired(onExpired);

    await expect(api.get("/me")).rejects.toThrow(ApiError);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries the failed request after the modal signals re-auth success", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 401,
        body: { error: "expired" },
      }),
    );
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));

    setOnSessionExpired(() => {
      setAuthToken("fresh-token");
      notifyReAuthResult(true);
    });

    const res = await api.get<{ ok: boolean }>("/me");
    expect(res.data).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("performs silent re-auth and retries when remember is on", async () => {
    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
      if (key === "remember_credentials") return "true";
      if (key === "saved_username") return "alice";
      if (key === "saved_password") return "secret";
      return null;
    });
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);

    // 1st: original request → 401
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 401,
        body: { error: "expired" },
      }),
    );
    // 2nd: silent re-auth /auth/login → new token
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        body: {
          token: "new-token",
          expiresAt: Date.now() + 60_000,
          user: { id: 1, username: "alice", role: "user" },
        },
      }),
    );
    // 3rd: retry of original request → 200
    mockFetch.mockResolvedValueOnce(mockResponse({ body: { success: true } }));

    const onRefreshed = jest.fn();
    setOnAuthRefreshed(onRefreshed);

    const res = await api.get<{ success: boolean }>("/library/artists");

    expect(res.data).toEqual({ success: true });
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(onRefreshed).toHaveBeenCalledWith(
      "new-token",
      JSON.stringify({ id: 1, username: "alice", role: "user" }),
      expect.any(Number),
    );
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry a request that has already been retried", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockFetch.mockResolvedValue(
      mockResponse({ ok: false, status: 401, body: { error: "still no" } }),
    );
    const onExpired = jest.fn(() => notifyReAuthResult(false));
    setOnSessionExpired(onExpired);

    await expect(api.get("/me")).rejects.toThrow(ApiError);

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
