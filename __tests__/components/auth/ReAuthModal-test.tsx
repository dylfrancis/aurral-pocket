jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium", Heavy: "heavy" },
}));

jest.mock("@/hooks/auth/use-biometric-availability", () => ({
  useBiometricAvailability: jest.fn(() => null),
  authenticateWithBiometrics: jest.fn(),
}));

jest.mock("react-native-keyboard-controller", () => {
  const { View } = require("react-native");
  return { KeyboardAvoidingView: View };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

jest.mock("expo-web-browser", () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock("react-native-webview", () => ({ WebView: () => null }));

import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { fetch } from "expo/fetch";
import { openAuthSessionAsync } from "expo-web-browser";
import {
  Alert,
  AppState,
  type AppStateStatus,
  Pressable,
  Text,
} from "react-native";
import { ReAuthModal } from "@/components/auth/ReAuthModal";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { api, notifyReAuthResult, setAuthToken } from "@/lib/api/client";
import {
  authenticateWithBiometrics,
  useBiometricAvailability,
} from "@/hooks/auth/use-biometric-availability";

const SERVER = "https://aurral.example.com";
const SUSPENDED = "This account has been suspended or disabled";

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockOpenAuthSession = openAuthSessionAsync as jest.Mock;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockFaceId = authenticateWithBiometrics as jest.Mock;
const mockBiometricLabel = useBiometricAvailability as jest.Mock;

function jsonResponse(status: number, body: unknown): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: () => null },
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/**
 * Aurral as a suspended account finds it: every session is gone, and the login
 * route answers with whatever the test says.
 */
function serveLostSession(login: () => any) {
  mockFetch.mockImplementation(async (url) =>
    String(url).endsWith("/auth/login")
      ? login()
      : jsonResponse(401, { error: "Unauthorized", code: "SESSION_INVALID" }),
  );
}

function Session() {
  const { token, clearAuth } = useAuth();
  return (
    <>
      <Text testID="token">{token ?? "signed-out"}</Text>
      <Pressable testID="sign-out-elsewhere" onPress={clearAuth} />
    </>
  );
}

async function renderSignedIn(stored: Record<string, string> = {}) {
  const secure = new Map<string, string>(
    Object.entries({
      auth_token: "dead-token",
      user_json: JSON.stringify({
        id: 1,
        username: "ada",
        role: "user",
        permissions: { accessPlaylists: false },
      }),
      ...stored,
    }),
  );
  mockSecureStore.getItemAsync.mockImplementation(
    async (key) => secure.get(key) ?? null,
  );
  mockSecureStore.setItemAsync.mockImplementation(async (key, value) => {
    secure.set(key, value);
  });
  mockSecureStore.deleteItemAsync.mockImplementation(async (key) => {
    secure.delete(key);
  });
  await AsyncStorage.setItem("server_url", SERVER);

  // gcTime keeps a finished mutation's five-minute timer from holding Jest open.
  const client = new QueryClient({
    defaultOptions: { mutations: { gcTime: 0 } },
  });
  const utils = await render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Session />
        <ReAuthModal />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(utils.getByTestId("token").props.children).toBe("dead-token"),
  );
  return { ...utils, secure };
}

const appStateListeners = new Set<(state: AppStateStatus) => void>();
const testedAppState = AppState as { currentState: unknown };
const presetAppState = testedAppState.currentState;

async function moveApp(state: AppStateStatus) {
  testedAppState.currentState = state;
  for (const listener of [...appStateListeners]) {
    await act(async () => listener(state));
  }
}

/** Any call from a screen, which is how a lost session comes to light. */
async function hitLostSession() {
  // Wrapped, because returning a promise from here would wait on it, and it
  // stays pending for as long as the prompt is open.
  const pending = { request: Promise.resolve<unknown>(null) };
  await act(async () => {
    pending.request = api.get("/library/artists").catch((error) => error);
  });
  return pending;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockOpenAuthSession.mockReset();
  await AsyncStorage.clear();
  setAuthToken(null);
  // A prompt a test left open would hold the client's one re-auth in flight.
  notifyReAuthResult(false);
  appStateListeners.clear();
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_type, listener) => {
      appStateListeners.add(listener);
      return { remove: () => appStateListeners.delete(listener) };
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  testedAppState.currentState = presetAppState;
  mockBiometricLabel.mockReturnValue(null);
});

describe("ReAuthModal", () => {
  it("ends on a suspended state when the typed password is refused", async () => {
    serveLostSession(() => jsonResponse(403, { error: SUSPENDED }));
    const { getByPlaceholderText, getByText, findByText, getByTestId } =
      await renderSignedIn();

    const { request } = await hitLostSession();
    await findByText("Session Expired");
    await fireEvent.changeText(getByPlaceholderText("Password"), "secret");
    await fireEvent.press(getByText("Continue"));

    await findByText("Account Suspended");
    await waitFor(() =>
      expect(getByTestId("token").props.children).toBe("signed-out"),
    );
    await expect(request).resolves.toMatchObject({ status: 401 });
  });

  it("goes straight there when saved credentials are refused", async () => {
    serveLostSession(() => jsonResponse(403, { error: SUSPENDED }));
    const { queryByText, findByText, getByTestId, secure } =
      await renderSignedIn({
        remember_credentials: "true",
        saved_username: "ada",
        saved_password: "secret",
      });

    await hitLostSession();

    await findByText("Account Suspended");
    expect(queryByText("Session Expired")).toBeNull();
    await waitFor(() =>
      expect(getByTestId("token").props.children).toBe("signed-out"),
    );
    // Left behind, the next launch would try them again and be refused again.
    await waitFor(() => expect(secure.has("saved_password")).toBe(false));
  });

  it("goes there from SSO, and ends the provider session too", async () => {
    serveLostSession(() => jsonResponse(500, {}));
    await AsyncStorage.setItem("oidc_session", "true");
    await AsyncStorage.setItem("oidc_logout_url", "https://idp.example/logout");
    const { getByTestId, findByText, findByTestId } = await renderSignedIn();

    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockOpenAuthSession.mockResolvedValue({
      type: "success",
      url: `aurralpocket://sso#error=${encodeURIComponent(SUSPENDED)}`,
    });

    await hitLostSession();
    const signIn = await findByTestId("reauth-oidc-sign-in");
    await act(async () => {
      fireEvent.press(signIn);
    });

    await findByText("Account Suspended");
    await waitFor(() =>
      expect(getByTestId("token").props.children).toBe("signed-out"),
    );
    await waitFor(async () =>
      expect(await AsyncStorage.getItem("oidc_session")).toBeNull(),
    );
  });

  it("closes once the message has been read", async () => {
    serveLostSession(() => jsonResponse(403, { error: SUSPENDED }));
    const { findByText, queryByText, getByTestId } = await renderSignedIn({
      remember_credentials: "true",
      saved_username: "ada",
      saved_password: "secret",
    });

    await hitLostSession();
    await findByText("Account Suspended");
    await waitFor(() =>
      expect(getByTestId("token").props.children).toBe("signed-out"),
    );
    await fireEvent.press(getByTestId("account-suspended-dismiss"));

    expect(queryByText("Account Suspended")).toBeNull();
    expect(queryByText("Session Expired")).toBeNull();
  });

  it("keeps the prompt for a refusal that isn't a suspension", async () => {
    serveLostSession(() => jsonResponse(403, { error: "Forbidden" }));
    const { getByPlaceholderText, getByText, findByText, queryByText } =
      await renderSignedIn();

    await hitLostSession();
    await findByText("Session Expired");
    await fireEvent.changeText(getByPlaceholderText("Password"), "secret");
    await fireEvent.press(getByText("Continue"));

    await findByText("Forbidden");
    expect(getByText("Session Expired")).toBeTruthy();
    expect(queryByText("Account Suspended")).toBeNull();
  });

  it("closes the prompt and settles waiting requests on any sign-out", async () => {
    serveLostSession(() => jsonResponse(500, {}));
    const { findByText, queryByText, getByTestId } = await renderSignedIn();

    const { request } = await hitLostSession();
    await findByText("Session Expired");
    await fireEvent.press(getByTestId("sign-out-elsewhere"));

    await waitFor(() => expect(queryByText("Session Expired")).toBeNull());
    await expect(request).resolves.toMatchObject({ status: 401 });
  });

  // Left behind, it would sign a later account's lost session, say one
  // signed in with SSO, back in as this one.
  it("forgets the saved password on Sign Out, as Settings does", async () => {
    serveLostSession(() => jsonResponse(500, {}));
    const { findByText, getByText, getByTestId, secure } = await renderSignedIn(
      {
        remember_credentials: "true",
        saved_username: "ada",
        saved_password: "secret",
      },
    );

    await hitLostSession();
    await findByText("Session Expired");
    await fireEvent.press(getByText("Sign Out"));

    await waitFor(() =>
      expect(getByTestId("token").props.children).toBe("signed-out"),
    );
    expect(secure.has("saved_password")).toBe(false);
    expect(secure.get("remember_credentials")).not.toBe("true");
  });

  describe("at the saved expiry", () => {
    const pastExpiry = { token_expires_at: String(Date.now() - 60_000) };

    it("keeps a session the server still accepts, with its new expiry", async () => {
      const renewed = Date.now() + 7 * 24 * 60 * 60 * 1000;
      mockFetch.mockImplementation(async () =>
        jsonResponse(200, {
          user: { id: 1, username: "ada", role: "user" },
          expiresAt: renewed,
        }),
      );
      const { queryByText, secure } = await renderSignedIn(pastExpiry);

      await waitFor(() =>
        expect(secure.get("token_expires_at")).toBe(String(renewed)),
      );
      expect(queryByText("Session Expired")).toBeNull();
    });

    it("opens no prompt while the server can't be reached", async () => {
      mockFetch.mockRejectedValue(new TypeError("Network request failed"));
      const { queryByText } = await renderSignedIn(pastExpiry);

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      await act(async () => {});
      expect(queryByText("Session Expired")).toBeNull();
    });

    it("opens Session Expired once the server refuses the session", async () => {
      serveLostSession(() => jsonResponse(500, {}));
      const { findByText } = await renderSignedIn(pastExpiry);

      await findByText("Session Expired");
    });
  });

  describe("Face ID", () => {
    const faceIdOn = {
      use_biometrics: "true",
      saved_username: "ada",
      saved_password: "secret",
    };

    beforeEach(() => {
      mockBiometricLabel.mockReturnValue("Face ID");
      // The user cancels, so the prompt stays open.
      mockFaceId.mockResolvedValue(false);
      serveLostSession(() => jsonResponse(500, {}));
    });

    it("starts as soon as the prompt opens in the foreground", async () => {
      testedAppState.currentState = "active";
      const { findByText } = await renderSignedIn(faceIdOn);

      await hitLostSession();
      await findByText("Session Expired");

      expect(mockFaceId).toHaveBeenCalledTimes(1);
    });

    // With Face ID alone the password is readable only while the phone is
    // unlocked, so a launch on a locked phone, as CarPlay or Siri makes, can't
    // read it.
    it("still signs in after a launch that couldn't read the saved password", async () => {
      testedAppState.currentState = "active";
      mockFaceId.mockResolvedValue(true);
      serveLostSession(() =>
        jsonResponse(200, {
          token: "new-token",
          user: { id: 1, username: "ada", role: "user" },
          expiresAt: Date.now() + 86_400_000,
        }),
      );
      const { getByTestId, secure } = await renderSignedIn({
        use_biometrics: "true",
      });
      // The phone has been unlocked since.
      secure.set("saved_username", "ada");
      secure.set("saved_password", "secret");

      await hitLostSession();

      await waitFor(() =>
        expect(getByTestId("token").props.children).toBe("new-token"),
      );
    });

    it("waits for the app to come back when the prompt opens in the background", async () => {
      testedAppState.currentState = "background";
      const { findByText } = await renderSignedIn(faceIdOn);

      await hitLostSession();
      await findByText("Session Expired");
      expect(mockFaceId).not.toHaveBeenCalled();

      await moveApp("active");
      expect(mockFaceId).toHaveBeenCalledTimes(1);

      // The Face ID sheet itself takes the app out of active and back.
      await moveApp("inactive");
      await moveApp("active");
      expect(mockFaceId).toHaveBeenCalledTimes(1);
    });
  });
});
