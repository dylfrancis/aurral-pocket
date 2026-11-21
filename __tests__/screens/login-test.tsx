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

async function renderLogin() {
  mockFetch.mockImplementation(async (url) =>
    String(url).endsWith("/auth/login")
      ? jsonResponse(403, { error: SUSPENDED })
      : jsonResponse(200, {
          status: "ok",
          authRequired: true,
          onboardingRequired: false,
          oidcEnabled: true,
          oidcLogoutUrl: LOGOUT_URL,
        }),
  );
  await AsyncStorage.setItem("server_url", SERVER);

  // gcTime keeps query and mutation timers from holding Jest open.
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  const utils = await render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <LoginScreen />
        <ProviderLogout />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await utils.findByTestId("oidc-sign-in");
  return utils;
}

beforeEach(async () => {
  mockFetch.mockReset();
  mockOpenAuthSession.mockReset();
  await AsyncStorage.clear();
});

describe("signing in to a suspended account", () => {
  it("says so when the password is refused", async () => {
    const { getByPlaceholderText, getAllByText, findByText } =
      await renderLogin();

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
    const { getByTestId } = await renderLogin();

    await act(async () => {
      fireEvent.press(getByTestId("oidc-sign-in"));
    });

    // Left open, the provider would sign this account straight back in, and no
    // other account could use SSO on this device.
    await waitFor(() =>
      expect(getByTestId("provider-logout").props.children).toBe(LOGOUT_URL),
    );
  });
});
