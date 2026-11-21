jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
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
import { fetch } from "expo/fetch";
import { openAuthSessionAsync } from "expo-web-browser";
import { Alert, Text } from "react-native";
import LoginScreen from "@/app/(auth)/login";
import { AuthProvider, useAuth } from "@/contexts/auth-context";

const SERVER = "https://aurral.example.com";
const LOGOUT_URL = "https://idp.example.com/logout";
const SUSPENDED = "This account has been suspended or disabled";

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockOpenAuthSession = openAuthSessionAsync as jest.Mock;

function jsonResponse(status: number, body: unknown): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: () => null },
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function ProviderLogout() {
  const { pendingOidcLogoutUrl } = useAuth();
  return <Text testID="provider-logout">{pendingOidcLogoutUrl ?? "none"}</Text>;
}

const HEALTH = {
  status: "ok",
  authRequired: true,
  onboardingRequired: false,
  oidcEnabled: true,
  oidcLogoutUrl: LOGOUT_URL,
};

/**
 * Answers each health request with the next of `answers`, then keeps giving
 * the last one. An answer can be a promise held open.
 */
async function renderLogin(answers: unknown[] = [jsonResponse(200, HEALTH)]) {
  let calls = 0;
  mockFetch.mockImplementation(async (url) =>
    String(url).endsWith("/auth/login")
      ? jsonResponse(403, { error: SUSPENDED })
      : answers[Math.min(calls++, answers.length - 1)],
  );
  await AsyncStorage.setItem("server_url", SERVER);

  // gcTime keeps query and mutation timers from holding Jest open.
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: 1, retryDelay: 0 },
      mutations: { gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <LoginScreen />
        <ProviderLogout />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  mockFetch.mockReset();
  mockOpenAuthSession.mockReset();
  await AsyncStorage.clear();
});

describe("choosing how to sign in", () => {
  it("waits for the server, then offers SSO and the password form on request", async () => {
    let answer!: (response: unknown) => void;
    const { getByTestId, queryByPlaceholderText, findByTestId, getByText } =
      await renderLogin([new Promise((resolve) => (answer = resolve))]);

    expect(getByTestId("sign-in-methods-loading")).toBeTruthy();
    expect(queryByPlaceholderText("Username")).toBeNull();

    await act(async () => answer(jsonResponse(200, HEALTH)));
    await findByTestId("oidc-sign-in");
    expect(queryByPlaceholderText("Username")).toBeNull();

    await fireEvent.press(getByText("Sign in with a local account"));
    expect(queryByPlaceholderText("Username")).toBeTruthy();
    expect(queryByPlaceholderText("Password")).toBeTruthy();
    expect(getByTestId("oidc-sign-in")).toBeTruthy();
  });

  it("shows only the password form on a server without SSO", async () => {
    const { findByPlaceholderText, queryByTestId, queryByText } =
      await renderLogin([
        jsonResponse(200, {
          ...HEALTH,
          oidcEnabled: false,
          oidcLogoutUrl: null,
        }),
      ]);

    await findByPlaceholderText("Username");
    expect(queryByTestId("oidc-sign-in")).toBeNull();
    expect(queryByText("Sign in with a local account")).toBeNull();
  });

  it("falls back to the password form when health fails, and keeps it once a retry finds SSO", async () => {
    let answer!: (response: unknown) => void;
    const { findByPlaceholderText, findByTestId, getByPlaceholderText } =
      await renderLogin([
        jsonResponse(500, { error: "Internal Server Error" }),
        new Promise((resolve) => (answer = resolve)),
      ]);

    await findByPlaceholderText("Username");

    await act(async () => answer(jsonResponse(200, HEALTH)));
    await findByTestId("oidc-sign-in");
    expect(getByPlaceholderText("Username")).toBeTruthy();
  });
});

describe("signing in to a suspended account", () => {
  it("says so when the password is refused", async () => {
    const { findByText, getByPlaceholderText, getAllByText } =
      await renderLogin();

    await fireEvent.press(await findByText("Sign in with a local account"));
    await fireEvent.changeText(getByPlaceholderText("Username"), "ada");
    await fireEvent.changeText(getByPlaceholderText("Password"), "secret");
    // The screen's heading reads the same, and comes first.
    await fireEvent.press(getAllByText("Sign In")[1]);

    await findByText(SUSPENDED);
  });

  it("ends the provider's session when SSO is refused", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockOpenAuthSession.mockResolvedValue({
      type: "success",
      url: `aurralpocket://sso#error=${encodeURIComponent(SUSPENDED)}`,
    });
    const { findByTestId, getByTestId } = await renderLogin();
    const sso = await findByTestId("oidc-sign-in");

    await act(async () => {
      fireEvent.press(sso);
    });

    // Left open, the provider would sign this account straight back in, and no
    // other account could use SSO on this device.
    await waitFor(() =>
      expect(getByTestId("provider-logout").props.children).toBe(LOGOUT_URL),
    );
  });
});
