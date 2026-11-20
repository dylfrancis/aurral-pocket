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

jest.mock("@/lib/offline/saved-library", () => ({
  setSavedLibraryUser: jest.fn(async () => {}),
}));

jest.mock("@/lib/player/play-history", () => ({
  startPlayHistory: jest.fn(() => () => {}),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  buildAuthenticatedUrl,
  customHeadersFor,
  getServerUrl,
  setAuthToken,
  setBaseUrl,
  setCustomHeaders,
} from "@/lib/api/client";
import { setSavedLibraryUser } from "@/lib/offline/saved-library";
import { startPlayHistory } from "@/lib/player/play-history";
import {
  headlessSession,
  onSessionChanged,
  sessionChanged,
} from "@/lib/headless-session";

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const NOW = 1_800_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function store({
  serverUrl = "https://aurral.test" as string | null,
  token = "siri-token" as string | null,
  user = '{"id":7,"username":"alice"}' as string | null,
  lastActive = (NOW - DAY_MS) as number | null,
} = {}) {
  mockAsyncStorage.getItem.mockImplementation(async (key) =>
    key === "server_url" ? serverUrl : null,
  );
  mockSecureStore.getItemAsync.mockImplementation(async (key) => {
    if (key === "auth_token") return token;
    if (key === "user_json") return user;
    if (key === "custom_headers") return '{"CF-Access-Client-Id":"id"}';
    if (key === "last_active_at") return lastActive?.toString() ?? null;
    return null;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  setBaseUrl("");
  setAuthToken(null);
  setCustomHeaders({});
});

afterEach(() => jest.restoreAllMocks());

describe("headlessSession", () => {
  // Siri or a car woke the app: no window opened, so the auth provider never
  // mounted.
  it("restores the session when no screen has", async () => {
    store();

    await expect(headlessSession()).resolves.toEqual({ userId: 7 });

    expect(getServerUrl()).toBe("https://aurral.test");
    expect(buildAuthenticatedUrl("/stream/1")).toBe(
      "https://aurral.test/api/stream/1?token=siri-token",
    );
    expect(customHeadersFor("https://aurral.test/api/x")).toEqual({
      "CF-Access-Client-Id": "id",
    });
    expect(startPlayHistory).toHaveBeenCalledWith(7);
    expect(setSavedLibraryUser).toHaveBeenCalledWith(7);
  });

  it("leaves a session a screen restored alone", async () => {
    store();
    setBaseUrl("https://aurral.test");
    setAuthToken("screen-token");

    await expect(headlessSession()).resolves.toEqual({ userId: 7 });

    expect(buildAuthenticatedUrl("/stream/1")).toContain("token=screen-token");
    // The app layout already reports plays.
    expect(startPlayHistory).not.toHaveBeenCalled();
    expect(setSavedLibraryUser).toHaveBeenCalledWith(7);
  });

  it.each([
    ["no one is signed in", { token: null }],
    ["no server is set", { serverUrl: null }],
    ["a locked phone keeps the user unreadable", { user: null }],
    [
      "the account was left unopened for 31 days",
      { lastActive: NOW - 31 * DAY_MS },
    ],
  ])("has no session when %s", async (_, stored) => {
    store(stored);

    await expect(headlessSession()).resolves.toBeNull();

    expect(getServerUrl()).toBe("");
    expect(startPlayHistory).not.toHaveBeenCalled();
  });
});

describe("sessionChanged", () => {
  it("tells every listener, even after one throws, without failing the caller", () => {
    const failing = jest.fn(() => {
      throw new Error("CarPlay went away");
    });
    const listening = jest.fn();
    const stops = [onSessionChanged(failing), onSessionChanged(listening)];

    try {
      expect(() => sessionChanged("signedOut")).not.toThrow();
      expect(listening).toHaveBeenCalledWith("signedOut");
    } finally {
      stops.forEach((stop) => stop());
    }
  });
});
