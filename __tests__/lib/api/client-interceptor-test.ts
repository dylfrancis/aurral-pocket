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

jest.mock("axios", () => {
  const requestHandlers: any[] = [];
  const responseHandlers: any[] = [];

  const interceptors = {
    request: {
      handlers: requestHandlers,
      use: jest.fn((fulfilled, rejected) => {
        requestHandlers.push({ fulfilled, rejected });
        return requestHandlers.length - 1;
      }),
    },
    response: {
      handlers: responseHandlers,
      use: jest.fn((fulfilled, rejected) => {
        responseHandlers.push({ fulfilled, rejected });
        return responseHandlers.length - 1;
      }),
    },
  };

  const instance = {
    defaults: {
      baseURL: "https://test.com/api",
      headers: { "Content-Type": "application/json" },
    },
    interceptors,
    get: jest.fn(),
    post: jest.fn(),
  };

  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
      post: jest.fn(),
    },
    AxiosError: class AxiosError extends Error {
      code?: string;
      response?: any;
      config?: any;
    },
  };
});

import axios from "axios";
import * as SecureStore from "expo-secure-store";
import {
  ApiError,
  api,
  setAuthToken,
  setOnSessionExpired,
  setOnAuthRefreshed,
} from "@/lib/api/client";

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

function getResponseErrorHandler() {
  const handlers = (api.interceptors.response as any).handlers;
  return handlers[handlers.length - 1]?.rejected;
}

beforeEach(() => {
  jest.clearAllMocks();
  setAuthToken(null);
  setOnSessionExpired(null);
  setOnAuthRefreshed(null);
});

describe("response interceptor — real 401", () => {
  it("calls onSessionExpired when no saved credentials", async () => {
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);
    setAuthToken("valid-token");
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    const handler = getResponseErrorHandler();
    const error = {
      response: { status: 401, data: { message: "Authentication required" } },
      config: { headers: {} },
      code: undefined,
    };

    await expect(handler(error)).rejects.toThrow(ApiError);
    expect(onExpired).toHaveBeenCalled();
  });

  it("attempts silent re-auth when remember is on", async () => {
    setAuthToken("expired-token");

    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "remember_credentials") return "true";
      if (key === "saved_username") return "alice";
      if (key === "saved_password") return "pass123";
      return null;
    });

    const expiresAt = Date.now() + 86400000;
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        token: "new-token",
        expiresAt,
        user: { id: 1, username: "alice", role: "user" },
      },
    });

    const handler = getResponseErrorHandler();
    const error = {
      response: { status: 401, data: { message: "Auth required" } },
      config: { headers: {} },
      code: undefined,
    };

    try {
      await handler(error);
    } catch {
      // retry call may fail — we verify login was attempted
    }

    expect(axios.post).toHaveBeenCalledWith(
      "https://test.com/api/auth/login",
      { username: "alice", password: "pass123" },
      expect.any(Object),
    );
  });

  it("does not retry already-retried requests", async () => {
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);

    const handler = getResponseErrorHandler();
    const error = {
      response: { status: 401, data: { message: "Auth required" } },
      config: { headers: {}, _retried: true },
      code: undefined,
    };

    await expect(handler(error)).rejects.toThrow(ApiError);
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe("response interceptor — iOS timeout fallback", () => {
  it("treats ECONNABORTED as session expiry when token is (near) expired", async () => {
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);
    setAuthToken("some-token");
    // Token expired 10s ago — iOS may have swallowed a real 401.
    const expiredAt = Date.now() - 10_000;
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "token_expires_at") return String(expiredAt);
      return null;
    });

    const handler = getResponseErrorHandler();
    const error = {
      response: undefined,
      config: { headers: {} },
      code: "ECONNABORTED",
    };

    await expect(handler(error)).rejects.toThrow(ApiError);
    expect(onExpired).toHaveBeenCalled();
  });

  it("treats ECONNABORTED as network error when token is still fresh", async () => {
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);
    setAuthToken("some-token");
    // Token valid for another hour — a timeout here is a slow/dropped
    // connection, not an iOS-swallowed 401. Must not trigger session-expired.
    const expiresAt = Date.now() + 60 * 60 * 1000;
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "token_expires_at") return String(expiresAt);
      return null;
    });

    const handler = getResponseErrorHandler();
    const error = {
      response: undefined,
      config: { headers: {} },
      code: "ECONNABORTED",
    };

    await expect(handler(error)).rejects.toThrow("Unable to reach server");
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("does not treat timeout as session expiry when not authenticated", async () => {
    setAuthToken(null);

    const handler = getResponseErrorHandler();
    const error = {
      response: undefined,
      config: { headers: {} },
      code: "ECONNABORTED",
    };

    await expect(handler(error)).rejects.toThrow("Unable to reach server");
  });

  it("does not treat non-timeout network errors as session expiry", async () => {
    setAuthToken("some-token");

    const handler = getResponseErrorHandler();
    const error = {
      response: undefined,
      config: { headers: {} },
      code: "ERR_NETWORK",
    };

    await expect(handler(error)).rejects.toThrow("Unable to reach server");
  });
});

describe("response interceptor — non-401 errors", () => {
  it("throws ApiError with correct status for 500", async () => {
    const handler = getResponseErrorHandler();
    const error = {
      response: { status: 500, data: { error: "Internal server error" } },
      config: { headers: {} },
    };

    try {
      await handler(error);
      fail("should have thrown");
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(500);
      expect(e.message).toBe("Internal server error");
    }
  });

  it("throws network error when no response and no timeout", async () => {
    setAuthToken(null);
    const handler = getResponseErrorHandler();
    const error = {
      response: undefined,
      config: { headers: {} },
      code: undefined,
    };

    await expect(handler(error)).rejects.toThrow("Unable to reach server");
  });
});

describe("setOnAuthRefreshed", () => {
  it("is called with token, userJson and expiresAt after silent re-auth", async () => {
    const onRefreshed = jest.fn();
    setOnAuthRefreshed(onRefreshed);
    setAuthToken("expired");

    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "remember_credentials") return "true";
      if (key === "saved_username") return "bob";
      if (key === "saved_password") return "secret";
      return null;
    });

    const expiresAt = Date.now() + 86400000;
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        token: "fresh-token",
        expiresAt,
        user: { id: 2, username: "bob", role: "admin" },
      },
    });

    const handler = getResponseErrorHandler();
    const error = {
      response: { status: 401, data: { message: "Auth required" } },
      config: { headers: {} },
      code: undefined,
    };

    try {
      await handler(error);
    } catch {
      // retry may throw
    }

    expect(onRefreshed).toHaveBeenCalledWith(
      "fresh-token",
      JSON.stringify({ id: 2, username: "bob", role: "admin" }),
      expiresAt,
    );
  });
});
