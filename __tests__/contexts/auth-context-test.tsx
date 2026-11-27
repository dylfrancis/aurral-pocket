jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK: "after-first-unlock",
  WHEN_UNLOCKED: "when-unlocked",
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
  ApiError: jest.requireActual("@/lib/api/client").ApiError,
  notifyReAuthResult: jest.fn(),
  setAuthToken: jest.fn(),
  setBaseUrl: jest.fn(),
  setCustomHeaders: jest.fn(),
  setOnAccountSuspended: jest.fn(),
  setOnSessionExpired: jest.fn(),
  setOnAuthRefreshed: jest.fn(),
}));

jest.mock("@/lib/api/auth", () => ({
  getMe: jest.fn(),
}));

jest.mock("@/lib/tailscale", () => ({
  isTailscaleAvailable: true,
  startGateway: jest.fn(() => Promise.resolve("http://127.0.0.1:47862")),
  forgetGateway: jest.fn(() => Promise.resolve()),
  gatewayUrlFor: jest.fn(() => "http://127.0.0.1:47862"),
  signInWhenAsked: jest.fn(() => () => {}),
}));

import React, { useCallback } from "react";
import { Text, Pressable } from "react-native";
import { render, waitFor, fireEvent, act } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { setAuthToken, setBaseUrl, setCustomHeaders } from "@/lib/api/client";
import { getMe } from "@/lib/api/auth";
import { onSessionChanged } from "@/lib/headless-session";
import { forgetGateway, signInWhenAsked, startGateway } from "@/lib/tailscale";
import { TrackPlayer } from "react-native-nitro-player";

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockGetMe = getMe as jest.Mock;

// Interactive consumer that exposes context state and actions
function TestConsumer() {
  const auth = useAuth();

  const handleSetAuth = useCallback(async () => {
    await auth.setAuth(
      "new-token",
      { id: 1, username: "alice", role: "user", permissions: {} },
      Date.now() + 86400000,
    );
  }, [auth]);

  const handleSaveCredentials = useCallback(async () => {
    await auth.saveCredentials("alice", "pass123");
  }, [auth]);

  const handleRememberOn = useCallback(async () => {
    await auth.setRememberCredentials(true);
  }, [auth]);

  const handleRememberOff = useCallback(async () => {
    await auth.setRememberCredentials(false);
  }, [auth]);

  const handleBiometricsOn = useCallback(async () => {
    await auth.setUseBiometrics(true);
  }, [auth]);

  const handleBiometricsOff = useCallback(async () => {
    await auth.setUseBiometrics(false);
  }, [auth]);

  const handleClearAll = useCallback(async () => {
    await auth.clearAll();
  }, [auth]);

  const handleClearAuth = useCallback(async () => {
    await auth.clearAuth();
  }, [auth]);

  const handleMarkOidc = useCallback(async () => {
    await auth.markOidcSession(null);
  }, [auth]);

  return (
    <>
      <Text testID="token">{auth.token ?? "null"}</Text>
      <Text testID="serverUrl">{auth.serverUrl ?? "null"}</Text>
      <Text testID="user">{auth.user?.username ?? "null"}</Text>
      <Text testID="sessionExpired">{String(auth.sessionExpired)}</Text>
      <Text testID="accountSuspended">{String(auth.accountSuspended)}</Text>
      <Text testID="rememberCredentials">
        {String(auth.rememberCredentials)}
      </Text>
      <Text testID="useBiometrics">{String(auth.useBiometrics)}</Text>
      <Pressable testID="setAuth" onPress={handleSetAuth} />
      <Pressable testID="saveCredentials" onPress={handleSaveCredentials} />
      <Pressable testID="rememberOn" onPress={handleRememberOn} />
      <Pressable testID="rememberOff" onPress={handleRememberOff} />
      <Pressable testID="biometricsOn" onPress={handleBiometricsOn} />
      <Pressable testID="biometricsOff" onPress={handleBiometricsOff} />
      <Pressable testID="clearAll" onPress={handleClearAll} />
      <Pressable testID="clearAuth" onPress={handleClearAuth} />
      <Pressable testID="markOidc" onPress={handleMarkOidc} />
    </>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockSecureStore.getItemAsync.mockResolvedValue(null);
  mockAsyncStorage.getItem.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("AuthProvider — restore on mount", () => {
  it("restores token, user, server URL and its custom headers", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "my-token";
      if (key === "user_json")
        return '{"id":1,"username":"alice","role":"user"}';
      if (key === "custom_headers")
        return '{"CF-Access-Client-Id":"id.access"}';
      return null;
    });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("my-token");
      expect(getByTestId("serverUrl").props.children).toBe(
        "https://my-server.com",
      );
      expect(getByTestId("user").props.children).toBe("alice");
    });

    expect(setBaseUrl).toHaveBeenCalledWith("https://my-server.com");
    expect(setAuthToken).toHaveBeenCalledWith("my-token");
    // Before the first request, or a proxy would turn it away.
    expect(setCustomHeaders).toHaveBeenCalledWith({
      "CF-Access-Client-Id": "id.access",
    });
  });

  // Saved earlier, they kept the keychain's default, which a locked phone
  // can't read. Siri can start the app on a locked phone, and a session can
  // run out while it plays music there, with a silent sign-in to make.
  it("saves a restored session again, where a locked phone can read it", async () => {
    const stored: Record<string, string> = {
      auth_token: "my-token",
      user_json: '{"id":1,"username":"alice"}',
      custom_headers: '{"CF-Access-Client-Id":"id.access"}',
      remember_credentials: "true",
      saved_username: "alice",
      saved_password: "pass123",
      token_expires_at: String(Date.now() + 86_400_000),
    };
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(
      async (key) => stored[key] ?? null,
    );

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("my-token");
    });
    const readableWhileLocked = {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    };
    for (const [key, value] of Object.entries(stored)) {
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        key,
        value,
        readableWhileLocked,
      );
    }
  });

  // Face ID needs the phone unlocked, so its password stays readable only then.
  it("leaves a Face ID password readable only while unlocked", async () => {
    const stored: Record<string, string> = {
      auth_token: "my-token",
      user_json: '{"id":1,"username":"alice"}',
      use_biometrics: "true",
      saved_username: "alice",
      saved_password: "pass123",
    };
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(
      async (key) => stored[key] ?? null,
    );

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("my-token");
    });
    const readableWhileLocked = {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    };
    // The prompt reads it on a locked-phone launch to offer Face ID.
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "use_biometrics",
      "true",
      readableWhileLocked,
    );
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalledWith(
      "saved_password",
      "pass123",
      readableWhileLocked,
    );
  });

  it("starts with null state when nothing stored", async () => {
    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("null");
      expect(getByTestId("serverUrl").props.children).toBe("null");
    });
  });
});

describe("AuthProvider — a server reached through Tailscale", () => {
  const TAILNET = "http://aurral-host:3002";

  function storeTailscaleServer(extra: Record<string, string> = {}) {
    mockAsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === "server_url") return TAILNET;
      if (key === "tailscale") return '{"controlURL":"https://hs.example"}';
      return null;
    });
    mockSecureStore.getItemAsync.mockImplementation(
      async (key) => extra[key] ?? null,
    );
  }

  it("opens the gateway at launch and sends every request through it", async () => {
    storeTailscaleServer({ auth_token: "my-token" });

    const { getByTestId } = await renderWithProvider();
    await waitFor(() => {
      expect(getByTestId("serverUrl").props.children).toBe(TAILNET);
    });

    expect(startGateway).toHaveBeenCalledWith(TAILNET, {
      controlURL: "https://hs.example",
    });
    expect(setBaseUrl).toHaveBeenCalledWith("http://127.0.0.1:47862");
    expect(setBaseUrl).not.toHaveBeenCalledWith(TAILNET);
    // A node removed from the tailnet gets Tailscale's sign-in page.
    expect(signInWhenAsked).toHaveBeenCalled();
  });

  it("removes the phone from the tailnet when the server is forgotten", async () => {
    storeTailscaleServer({ auth_token: "my-token" });
    const { getByTestId } = await renderWithProvider();
    await waitFor(() => {
      expect(getByTestId("serverUrl").props.children).toBe(TAILNET);
    });

    await act(async () => {
      await fireEvent.press(getByTestId("clearAll"));
    });

    expect(forgetGateway).toHaveBeenCalledWith({
      controlURL: "https://hs.example",
    });
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("tailscale");
  });

  it("removes it too when 30 days without use reset the app", async () => {
    storeTailscaleServer({
      auth_token: "old-token",
      last_active_at: String(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });

    const { getByTestId } = await renderWithProvider();
    await waitFor(() => {
      expect(getByTestId("serverUrl").props.children).toBe("null");
    });

    expect(forgetGateway).toHaveBeenCalledWith({
      controlURL: "https://hs.example",
    });
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("tailscale");
    expect(startGateway).not.toHaveBeenCalled();
  });
});

describe("AuthProvider — 30-day inactivity hard expire", () => {
  const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;

  it("clears all data when inactive for more than 30 days", async () => {
    const oldTimestamp = String(Date.now() - THIRTY_ONE_DAYS_MS);

    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "old-token";
      if (key === "user_json")
        return '{"id":1,"username":"alice","role":"user"}';
      if (key === "last_active_at") return oldTimestamp;
      return null;
    });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("null");
      expect(getByTestId("serverUrl").props.children).toBe("null");
      expect(getByTestId("user").props.children).toBe("null");
    });

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith("auth_token");
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith("user_json");
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "saved_username",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "saved_password",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "remember_credentials",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "use_biometrics",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "token_expires_at",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "last_active_at",
    );
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("server_url");
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
      "date_time_format",
    );
    // Saved albums go with the server they came from.
    await waitFor(() =>
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("saved_offline"),
    );
  });

  it("restores normally when active within 30 days, and counts the launch as activity", async () => {
    const recentTimestamp = String(Date.now() - 5 * 24 * 60 * 60 * 1000);

    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "valid-token";
      if (key === "user_json")
        return '{"id":1,"username":"bob","role":"admin"}';
      if (key === "last_active_at") return recentTimestamp;
      return null;
    });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("valid-token");
      expect(getByTestId("user").props.children).toBe("bob");
    });

    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled();
    // The 30 days start again from this launch.
    const [, written] = mockSecureStore.setItemAsync.mock.calls.find(
      ([key]) => key === "last_active_at",
    )!;
    expect(Number(written)).toBeGreaterThan(Number(recentTimestamp));
  });

  it("restores normally when lastActiveAt is not set (fresh install)", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "fresh-token";
      if (key === "user_json")
        return '{"id":1,"username":"carol","role":"user"}';
      return null;
    });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("fresh-token");
      expect(getByTestId("user").props.children).toBe("carol");
    });
  });
});

describe("AuthProvider — setAuth bumps lastActiveAt", () => {
  it("writes lastActiveAt to storage on setAuth", async () => {
    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("null");
    });

    await act(async () => {
      await fireEvent.press(getByTestId("setAuth"));
    });

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("new-token");
    });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "last_active_at",
      expect.stringMatching(/^\d+$/),
      expect.anything(),
    );
  });
});

describe("AuthProvider — credential clearing logic", () => {
  it("turning on remember disables biometrics but keeps stored credentials intact", async () => {
    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("null");
    });

    await act(async () => {
      await fireEvent.press(getByTestId("biometricsOn"));
    });

    jest.clearAllMocks();

    await act(async () => {
      await fireEvent.press(getByTestId("rememberOn"));
    });

    expect(getByTestId("rememberCredentials").props.children).toBe("true");
    expect(getByTestId("useBiometrics").props.children).toBe("false");
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "use_biometrics",
      "false",
      expect.anything(),
    );
    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      "saved_username",
    );
    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      "saved_password",
    );
  });

  it("does not clear credentials when turning off biometrics if remember is on", async () => {
    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("null");
    });

    await act(async () => {
      await fireEvent.press(getByTestId("rememberOn"));
    });
    await act(async () => {
      await fireEvent.press(getByTestId("biometricsOn"));
    });

    jest.clearAllMocks();

    // Turn off biometrics — credentials should NOT be deleted because remember is still on
    await act(async () => {
      await fireEvent.press(getByTestId("biometricsOff"));
    });

    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      "saved_username",
    );
    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      "saved_password",
    );
  });

  it("clears credentials when both remember and biometrics are off", async () => {
    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("null");
    });

    // Enable remember, then turn it off (biometrics already off)
    await act(async () => {
      await fireEvent.press(getByTestId("rememberOn"));
    });

    jest.clearAllMocks();

    await act(async () => {
      await fireEvent.press(getByTestId("rememberOff"));
    });

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "saved_username",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "saved_password",
    );
  });
});

// A saved password beside an SSO session came from an earlier account, and a
// lost session would sign in with it, switching to that account.
describe("AuthProvider — an SSO session keeps no saved password", () => {
  const leftover: Record<string, string> = {
    auth_token: "sso-token",
    user_json:
      '{"id":2,"username":"bob","permissions":{"accessPlaylists":true}}',
    remember_credentials: "true",
    saved_username: "alice",
    saved_password: "pass123",
  };

  it("drops one left from before, at launch", async () => {
    mockAsyncStorage.getItem.mockImplementation(async (key) =>
      key === "oidc_session" ? "true" : "https://my-server.com",
    );
    mockSecureStore.getItemAsync.mockImplementation(
      async (key) => leftover[key] ?? null,
    );

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("sso-token");
    });
    expect(getByTestId("rememberCredentials").props.children).toBe("false");
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "saved_password",
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "remember_credentials",
      "false",
      expect.anything(),
    );
  });

  it("drops one when an SSO session starts", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(
      async (key) => leftover[key] ?? null,
    );
    const { getByTestId } = await renderWithProvider();
    await waitFor(() => {
      expect(getByTestId("rememberCredentials").props.children).toBe("true");
    });

    await act(async () => {
      await fireEvent.press(getByTestId("markOidc"));
    });

    expect(getByTestId("rememberCredentials").props.children).toBe("false");
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "saved_password",
    );
  });
});

describe("AuthProvider — saveCredentials conditional", () => {
  it("does not save when neither remember nor biometrics is enabled", async () => {
    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("rememberCredentials").props.children).toBe("false");
      expect(getByTestId("useBiometrics").props.children).toBe("false");
    });

    await act(async () => {
      await fireEvent.press(getByTestId("saveCredentials"));
    });

    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalledWith(
      "saved_username",
      "alice",
      expect.anything(),
    );
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalledWith(
      "saved_password",
      "pass123",
      expect.anything(),
    );
  });

  it("saves when remember is enabled, where a locked phone can read them", async () => {
    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("null");
    });

    await act(async () => {
      await fireEvent.press(getByTestId("rememberOn"));
    });

    jest.clearAllMocks();

    await act(async () => {
      await fireEvent.press(getByTestId("saveCredentials"));
    });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "saved_username",
      "alice",
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "saved_password",
      "pass123",
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
    );
  });

  // Face ID needs the phone unlocked anyway.
  it("saves when biometrics is enabled (even without remember), readable only while unlocked", async () => {
    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("null");
    });

    await act(async () => {
      await fireEvent.press(getByTestId("biometricsOn"));
    });

    jest.clearAllMocks();

    await act(async () => {
      await fireEvent.press(getByTestId("saveCredentials"));
    });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "saved_username",
      "alice",
      { keychainAccessible: SecureStore.WHEN_UNLOCKED },
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "saved_password",
      "pass123",
      { keychainAccessible: SecureStore.WHEN_UNLOCKED },
    );
  });
});

describe("AuthProvider — clearAll", () => {
  it("clears all state and storage including lastActiveAt", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "my-token";
      if (key === "user_json")
        return '{"id":1,"username":"alice","role":"user"}';
      return null;
    });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("my-token");
    });

    jest.clearAllMocks();

    await act(async () => {
      await fireEvent.press(getByTestId("clearAll"));
    });

    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("null");
      expect(getByTestId("serverUrl").props.children).toBe("null");
      expect(getByTestId("user").props.children).toBe("null");
    });

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "last_active_at",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "token_expires_at",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "saved_username",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "saved_password",
    );
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("server_url");
    // The headers belong to the server, so the next one starts without them.
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "custom_headers",
    );
    expect(setCustomHeaders).toHaveBeenCalledWith({});
    // Saved albums go with the server they came from.
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("saved_offline");
  });
});

describe("AuthProvider — clearAuth", () => {
  it("stops the player and forgets the queue", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "my-token";
      if (key === "user_json")
        return '{"id":1,"username":"alice","role":"user"}';
      return null;
    });

    const { getByTestId } = await renderWithProvider();
    await waitFor(() => {
      expect(getByTestId("token").props.children).toBe("my-token");
    });
    jest.clearAllMocks();

    await act(async () => {
      await fireEvent.press(getByTestId("clearAuth"));
    });

    await waitFor(() => {
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        "playback_queue",
      );
    });
    expect(TrackPlayer.pause).toHaveBeenCalled();
    // Saved albums wait on the phone for the account to sign back in.
    expect(mockAsyncStorage.removeItem).not.toHaveBeenCalledWith(
      "saved_offline",
    );
    // The server stays chosen, so the next sign-in starts at the login screen.
    expect(getByTestId("token").props.children).toBe("null");
    expect(getByTestId("serverUrl").props.children).toBe(
      "https://my-server.com",
    );
  });
});

describe("AuthProvider — sign-out", () => {
  // The car reads the stored session itself. Told any sooner, it would read
  // the token sign-out is still deleting and bring the session back.
  it.each(["clearAuth", "clearAll"])(
    "tells the car once %s has deleted the stored token",
    async (testID) => {
      mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
      mockSecureStore.getItemAsync.mockImplementation(async (key) => {
        if (key === "auth_token") return "my-token";
        if (key === "user_json")
          return '{"id":1,"username":"alice","role":"user"}';
        return null;
      });
      const { getByTestId } = await renderWithProvider();
      await waitFor(() => {
        expect(getByTestId("token").props.children).toBe("my-token");
      });
      let deleteToken!: () => void;
      mockSecureStore.deleteItemAsync.mockImplementation((key) =>
        key === "auth_token"
          ? new Promise<void>((resolve) => {
              deleteToken = resolve;
            })
          : Promise.resolve(),
      );
      const cleared = jest.fn();
      const stop = onSessionChanged(cleared);

      try {
        await act(async () => {
          void fireEvent.press(getByTestId(testID));
        });
        expect(cleared).not.toHaveBeenCalled();

        await act(async () => deleteToken());
        await waitFor(() => expect(cleared).toHaveBeenCalledWith("signedOut"));
      } finally {
        stop();
        mockSecureStore.deleteItemAsync.mockReset();
      }
    },
  );
});

describe("AuthProvider — sign-in", () => {
  it("tells the car once sign-in has stored the token", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    const { getByTestId } = await renderWithProvider();
    let saveToken!: () => void;
    mockSecureStore.setItemAsync.mockImplementation((key) =>
      key === "auth_token"
        ? new Promise<void>((resolve) => {
            saveToken = resolve;
          })
        : Promise.resolve(),
    );
    const changed = jest.fn();
    const stop = onSessionChanged(changed);

    try {
      await act(async () => {
        void fireEvent.press(getByTestId("setAuth"));
      });
      expect(changed).not.toHaveBeenCalled();

      await act(async () => saveToken());
      await waitFor(() => expect(changed).toHaveBeenCalledWith("signedIn"));
    } finally {
      stop();
      mockSecureStore.setItemAsync.mockReset();
    }
  });
});

describe("AuthProvider — user rehydration from /auth/me", () => {
  const alice = {
    id: 1,
    username: "alice",
    role: "user" as const,
    permissions: { accessPlaylists: true },
  };

  it("recovers the user when a token is stored but the cached user is missing", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "my-token";
      return null; // no user_json
    });
    mockGetMe.mockResolvedValue({ user: alice, expiresAt: 123 });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("user").props.children).toBe("alice");
    });
    expect(mockGetMe).toHaveBeenCalled();
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "user_json",
      JSON.stringify(alice),
      expect.anything(),
    );
  });

  it("recovers the user when the cached user JSON is corrupt", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "my-token";
      if (key === "user_json") return "{not valid json";
      return null;
    });
    mockGetMe.mockResolvedValue({ user: alice, expiresAt: 123 });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("user").props.children).toBe("alice");
    });
  });

  it("does not call /auth/me when the cached user is already valid", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "my-token";
      if (key === "user_json") return JSON.stringify(alice);
      return null;
    });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(getByTestId("user").props.children).toBe("alice");
    });
    expect(mockGetMe).not.toHaveBeenCalled();
  });

  it("refreshes a cached user saved before accessPlaylists existed", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "my-token";
      if (key === "user_json")
        return JSON.stringify({ ...alice, permissions: { accessFlow: true } });
      return null;
    });
    mockGetMe.mockResolvedValue({ user: alice, expiresAt: 123 });

    await renderWithProvider();

    await waitFor(() =>
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "user_json",
        JSON.stringify(alice),
        expect.anything(),
      ),
    );
  });

  it("does not call /auth/me when there is no token", async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    await renderWithProvider();

    await waitFor(() => {
      expect(mockGetMe).not.toHaveBeenCalled();
    });
  });

  it("leaves the user null when /auth/me fails, without crashing", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === "auth_token") return "my-token";
      return null;
    });
    mockGetMe.mockRejectedValue(new Error("network down"));

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => {
      expect(mockGetMe).toHaveBeenCalled();
    });
    expect(getByTestId("user").props.children).toBe("null");
    expect(getByTestId("token").props.children).toBe("my-token");
  });
});
