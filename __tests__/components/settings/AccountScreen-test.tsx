jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("@expo/ui", () => require("@/test-support/expo-ui"));

import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Burnt from "burnt";
import * as SecureStore from "expo-secure-store";
import { fetch } from "expo/fetch";
import { Text } from "react-native";
import { AccountScreen } from "@/components/settings/AccountScreen";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { setAuthToken } from "@/lib/api/client";

const SERVER = "https://aurral.example.com";
const CURRENT = "Current-Password-1!";
const NEXT = "Brand-New-Password-2!";

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockToast = Burnt.toast as jest.Mock;

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
 * The password rules of Aurral 2.13.0, as checked against a real server.
 * `recent` is whether the session signed in within the last 15 minutes.
 */
function serveAurral(account: { recent: boolean; hasPassword: boolean }) {
  let { recent } = account;
  let sessionAlive = true;
  const calls: string[] = [];
  const lostSession = () =>
    jsonResponse(401, { error: "Unauthorized", code: "SESSION_INVALID" });

  mockFetch.mockImplementation(async (url, init) => {
    const path = String(url).replace(`${SERVER}/api`, "");
    calls.push(path);
    const body = JSON.parse((init?.body as string) ?? "{}");

    switch (path) {
      case "/auth/reauth":
        if (!sessionAlive) return lostSession();
        if (!account.hasPassword) {
          return jsonResponse(400, {
            error: "no_local_password",
            message:
              "This account has no local password. Sign out and back in to refresh your session.",
          });
        }
        if (body.currentPassword !== CURRENT) {
          return jsonResponse(400, { error: "Current password is incorrect" });
        }
        recent = true;
        return jsonResponse(200, { success: true });
      case "/users/me/password":
        if (!sessionAlive) return lostSession();
        if (!recent) {
          return jsonResponse(401, {
            error: "reauth_required",
            message: "Please confirm your credentials to continue",
          });
        }
        // Changing a password deletes every session the account has.
        sessionAlive = false;
        return jsonResponse(200, { success: true });
      case "/auth/logout":
        return sessionAlive
          ? jsonResponse(200, { success: true })
          : lostSession();
      default:
        return jsonResponse(404, { error: "Not found" });
    }
  });
  return calls;
}

function Session() {
  const { token, sessionExpired } = useAuth();
  return (
    <>
      <Text testID="token">{token ?? "signed-out"}</Text>
      <Text testID="session-expired">{String(sessionExpired)}</Text>
    </>
  );
}

async function renderSignedIn(stored: Record<string, string> = {}) {
  const secure = new Map<string, string>(
    Object.entries({
      auth_token: "session-token",
      user_json: JSON.stringify({
        id: 1,
        username: "ada",
        role: "user",
        permissions: {},
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
        <AccountScreen />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(utils.getByTestId("token").props.children).toBe("session-token"),
  );
  return utils;
}

async function submitForm(
  utils: Awaited<ReturnType<typeof renderSignedIn>>,
  currentPassword = CURRENT,
) {
  await fireEvent.changeText(
    utils.getByPlaceholderText("Current password"),
    currentPassword,
  );
  await fireEvent.changeText(utils.getByPlaceholderText("New password"), NEXT);
  await fireEvent.changeText(
    utils.getByPlaceholderText("Confirm new password"),
    NEXT,
  );
  await fireEvent.press(utils.getByText("Update Password"));
}

const SAVED_CREDENTIALS = {
  remember_credentials: "true",
  saved_username: "ada",
  saved_password: CURRENT,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  setAuthToken(null);
});

describe("AccountScreen password change", () => {
  it.each([
    ["without saved credentials", {}],
    ["with saved credentials", SAVED_CREDENTIALS],
  ])(
    "changes the password from an old session %s, and no prompt follows",
    async (_, stored) => {
      const calls = serveAurral({ recent: false, hasPassword: true });
      const utils = await renderSignedIn(stored);

      await submitForm(utils);

      await waitFor(() =>
        expect(utils.getByTestId("token").props.children).toBe("signed-out"),
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Password updated" }),
      );
      expect(calls).toEqual([
        "/auth/reauth",
        "/users/me/password",
        "/auth/logout",
      ]);
      // The logout's 401 arrives after the sign-out has begun.
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
      await new Promise((resolve) => setImmediate(resolve));
      expect(utils.getByTestId("session-expired").props.children).toBe("false");
    },
  );

  it("stops at a wrong current password", async () => {
    const calls = serveAurral({ recent: false, hasPassword: true });
    const utils = await renderSignedIn();

    await submitForm(utils, "not-the-password");

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Current password is incorrect",
        }),
      ),
    );
    expect(calls).toEqual(["/auth/reauth"]);
    expect(utils.getByTestId("token").props.children).toBe("session-token");
  });

  it("tells an SSO-only account on an old session to sign in again", async () => {
    serveAurral({ recent: false, hasPassword: false });
    const utils = await renderSignedIn();

    await submitForm(utils, "anything");

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Sign in again with SSO" }),
      ),
    );
    expect(utils.getByTestId("token").props.children).toBe("session-token");
    expect(utils.getByTestId("session-expired").props.children).toBe("false");
  });

  it("lets an SSO-only account that just signed in set a password", async () => {
    // What "sign in again" leads to. If the refusal from /auth/reauth stopped
    // the form here, that advice could never be followed.
    serveAurral({ recent: true, hasPassword: false });
    const utils = await renderSignedIn();

    await submitForm(utils, "anything");

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Password updated" }),
      ),
    );
  });

  it("keeps Update Password off until the new password is confirmed", async () => {
    const calls = serveAurral({ recent: true, hasPassword: true });
    const utils = await renderSignedIn();

    await fireEvent.changeText(
      utils.getByPlaceholderText("Current password"),
      CURRENT,
    );
    await fireEvent.changeText(
      utils.getByPlaceholderText("New password"),
      NEXT,
    );
    await fireEvent.changeText(
      utils.getByPlaceholderText("Confirm new password"),
      "Something-Else-3!",
    );
    await fireEvent.press(utils.getByText("Update Password"));

    expect(
      utils.getByText("New password and confirmation must match."),
    ).toBeTruthy();
    expect(calls).toEqual([]);
  });
});
