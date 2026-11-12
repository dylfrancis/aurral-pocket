jest.mock("@expo/ui", () => require("@/test-support/expo-ui"));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

const mockParams: { service: string } = { service: "listenbrainz" };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
}));

const mockAuth = {
  serverUrl: "https://aurral.example.com",
  token: "session-token",
  user: { id: 1, username: "ada", role: "user", permissions: {} } as {
    id: number;
    username: string;
    role: "admin" | "user";
    permissions: Record<string, boolean>;
  },
};
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("@/lib/api/scrobbling", () => ({
  getScrobbleStatus: jest.fn(),
  linkScrobbler: jest.fn(),
  unlinkScrobbler: jest.fn(),
}));

jest.mock("@/lib/api/me", () => ({
  getMyListeningHistory: jest.fn(),
  updateMyListeningHistory: jest.fn(),
}));

import React from "react";
import { AppState, Linking } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ListeningServiceScreen } from "@/components/settings/ListeningServiceScreen";
import { getMyListeningHistory, updateMyListeningHistory } from "@/lib/api/me";
import {
  getScrobbleStatus,
  linkScrobbler,
  unlinkScrobbler,
} from "@/lib/api/scrobbling";
import type { ScrobbleStatus } from "@/lib/types/scrobbling";

const mockGetStatus = getScrobbleStatus as jest.Mock;
const mockLink = linkScrobbler as jest.Mock;
const mockUnlink = unlinkScrobbler as jest.Mock;
const mockGetHistory = getMyListeningHistory as jest.Mock;
const mockUpdateHistory = updateMyListeningHistory as jest.Mock;

const disconnected = { connected: false, displayName: null, connectedAt: null };

function status(overrides: Partial<ScrobbleStatus> = {}): ScrobbleStatus {
  return {
    lastfm: { ...disconnected, configured: true },
    listenbrainz: disconnected,
    koito: disconnected,
    ...overrides,
  };
}

async function renderService(service: string) {
  mockParams.service = service;
  // gcTime keeps a finished query's timers from holding Jest open.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  const utils = await render(
    <QueryClientProvider client={client}>
      <ListeningServiceScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mockGetStatus).toHaveBeenCalled());
  await waitFor(() => expect(mockGetHistory).toHaveBeenCalled());
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = {
    id: 1,
    username: "ada",
    role: "user",
    permissions: {},
  };
  mockGetStatus.mockResolvedValue(status());
  mockGetHistory.mockResolvedValue({
    lastfm: "ada-fm",
    listenbrainz: null,
    koito: null,
  });
});

describe("ListeningServiceScreen", () => {
  it("connects ListenBrainz with the pasted token, then reloads the history it fills in", async () => {
    mockLink.mockResolvedValue({ connected: true, displayName: "ada" });
    const utils = await renderService("listenbrainz");

    await fireEvent.changeText(
      await utils.findByPlaceholderText("User token"),
      "  lb-token  ",
    );
    await fireEvent.press(utils.getByText("Connect ListenBrainz"));

    await waitFor(() =>
      expect(mockLink).toHaveBeenCalledWith("listenbrainz", "lb-token"),
    );
    await waitFor(() => expect(mockGetHistory).toHaveBeenCalledTimes(2));
    expect(mockGetStatus).toHaveBeenCalledTimes(2);
    expect(utils.getByPlaceholderText("User token").props.value).toBe("");
  });

  it("drops an unsaved username when connecting fills one in", async () => {
    mockLink.mockResolvedValue({ connected: true, displayName: "lb-ada" });
    const utils = await renderService("listenbrainz");

    await fireEvent.changeText(
      await utils.findByPlaceholderText("Username"),
      "typed-but-unsaved",
    );
    expect(utils.getByText("Save")).toBeTruthy();

    mockGetHistory.mockResolvedValue({
      lastfm: "ada-fm",
      listenbrainz: "lb-ada",
      koito: null,
    });
    await fireEvent.changeText(
      utils.getByPlaceholderText("User token"),
      "lb-token",
    );
    await fireEvent.press(utils.getByText("Connect ListenBrainz"));

    expect(await utils.findByDisplayValue("lb-ada")).toBeTruthy();
    expect(utils.queryByText("Save")).toBeNull();
  });

  it.each([
    ["saves a changed username, trimmed", " new-name ", "new-name"],
    ["clears the service when the field is emptied", "", null],
  ])("%s, for this service only", async (_, typed, sent) => {
    mockUpdateHistory.mockResolvedValue({
      lastfm: sent,
      listenbrainz: null,
      koito: null,
    });
    const utils = await renderService("lastfm");

    await fireEvent.changeText(await utils.findByDisplayValue("ada-fm"), typed);
    await fireEvent.press(utils.getByText("Save"));

    await waitFor(() => expect(mockUpdateHistory).toHaveBeenCalledTimes(1));
    expect(mockUpdateHistory.mock.calls[0][0]).toEqual({ lastfm: sent });
  });

  it("lets an account without Access Settings disconnect Koito but not link it", async () => {
    mockGetStatus.mockResolvedValue(
      status({
        koito: {
          connected: true,
          displayName: "koito.example.com",
          connectedAt: 1,
        },
      }),
    );
    mockUnlink.mockResolvedValue(undefined);
    const utils = await renderService("koito");

    expect(
      await utils.findByText("Connected as koito.example.com"),
    ).toBeTruthy();
    expect(utils.queryByPlaceholderText("API key")).toBeNull();

    await fireEvent.press(utils.getByText("Disconnect"));
    await waitFor(() => expect(mockUnlink).toHaveBeenCalledWith("koito"));
  });

  it("links Last.fm in the web app and reloads both reads on return", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    let onAppState: (state: string) => void = () => {};
    jest.spyOn(AppState, "addEventListener").mockImplementation(((
      _: string,
      handler: (state: string) => void,
    ) => {
      onAppState = handler;
      return { remove: jest.fn() };
    }) as never);
    const utils = await renderService("lastfm");

    await fireEvent.press(await utils.findByText("Connect in Aurral"));
    expect(openURL).toHaveBeenCalledWith(
      "https://aurral.example.com/?settings=listening%2Flastfm",
    );

    onAppState("active");
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(2));
    expect(mockGetHistory).toHaveBeenCalledTimes(2);
  });

  it("tells a user that an admin has to add the Last.fm key first", async () => {
    mockGetStatus.mockResolvedValue(
      status({ lastfm: { ...disconnected, configured: false } }),
    );
    const utils = await renderService("lastfm");

    expect(
      await utils.findByText(
        "An admin needs to add a Last.fm API key before you can connect.",
      ),
    ).toBeTruthy();
    expect(utils.queryByText("Connect in Aurral")).toBeNull();
  });
});
