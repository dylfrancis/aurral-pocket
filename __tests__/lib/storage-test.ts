jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SecureStorage, AppStorage } from "@/lib/storage";

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => jest.clearAllMocks());

describe("SecureStorage.token", () => {
  it("gets token", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue("my-token");
    expect(await SecureStorage.getToken()).toBe("my-token");
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith("auth_token");
  });

  it("returns null on error", async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(new Error("fail"));
    expect(await SecureStorage.getToken()).toBeNull();
  });

  it("sets token", async () => {
    await SecureStorage.setToken("new-token");
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "auth_token",
      "new-token",
    );
  });

  it("deletes token", async () => {
    await SecureStorage.deleteToken();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith("auth_token");
  });
});

describe("SecureStorage.user", () => {
  it("gets user JSON", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('{"id":1}');
    expect(await SecureStorage.getUser()).toBe('{"id":1}');
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith("user_json");
  });

  it("sets user JSON", async () => {
    await SecureStorage.setUser('{"id":1}');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "user_json",
      '{"id":1}',
    );
  });

  it("deletes user", async () => {
    await SecureStorage.deleteUser();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith("user_json");
  });
});

describe("AppStorage", () => {
  it("gets server URL", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://my-server.com");
    expect(await AppStorage.getServerUrl()).toBe("https://my-server.com");
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("server_url");
  });

  it("returns null when no URL stored", async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    expect(await AppStorage.getServerUrl()).toBeNull();
  });

  it("returns null on error", async () => {
    mockAsyncStorage.getItem.mockRejectedValue(new Error("fail"));
    expect(await AppStorage.getServerUrl()).toBeNull();
  });

  it("sets server URL", async () => {
    await AppStorage.setServerUrl("https://example.com");
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "server_url",
      "https://example.com",
    );
  });

  it("deletes server URL", async () => {
    await AppStorage.deleteServerUrl();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("server_url");
  });
});

describe("AppStorage.themePreference", () => {
  it("gets a valid theme preference", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("dark");
    expect(await AppStorage.getThemePreference()).toBe("dark");
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("theme_preference");
  });

  it("returns null when nothing stored", async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    expect(await AppStorage.getThemePreference()).toBeNull();
  });

  it("returns null for an unrecognized value", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("solarized");
    expect(await AppStorage.getThemePreference()).toBeNull();
  });

  it("returns null on error", async () => {
    mockAsyncStorage.getItem.mockRejectedValue(new Error("fail"));
    expect(await AppStorage.getThemePreference()).toBeNull();
  });

  it("sets the theme preference", async () => {
    await AppStorage.setThemePreference("light");
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "theme_preference",
      "light",
    );
  });

  it("deletes the theme preference", async () => {
    await AppStorage.deleteThemePreference();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
      "theme_preference",
    );
  });
});

describe("AppStorage.dateTimeFormat", () => {
  it("gets a stored format", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("year-first");
    expect(await AppStorage.getDateTimeFormat()).toBe("year-first");
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("date_time_format");
  });

  it("returns null when nothing stored", async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    expect(await AppStorage.getDateTimeFormat()).toBeNull();
  });

  it("returns null for a format the server does not offer", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("iso-8601");
    expect(await AppStorage.getDateTimeFormat()).toBeNull();
  });

  it("returns null on error", async () => {
    mockAsyncStorage.getItem.mockRejectedValue(new Error("fail"));
    expect(await AppStorage.getDateTimeFormat()).toBeNull();
  });

  it("sets the format", async () => {
    await AppStorage.setDateTimeFormat("day-first");
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "date_time_format",
      "day-first",
    );
  });

  it("deletes the format", async () => {
    await AppStorage.deleteDateTimeFormat();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
      "date_time_format",
    );
  });
});

describe("AppStorage.oidcSession", () => {
  it("reads the flag as a boolean", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("true");
    expect(await AppStorage.getOidcSession()).toBe(true);
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("oidc_session");
  });

  it("reads absent as false", async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    expect(await AppStorage.getOidcSession()).toBe(false);
  });

  it("returns false on error", async () => {
    mockAsyncStorage.getItem.mockRejectedValue(new Error("fail"));
    expect(await AppStorage.getOidcSession()).toBe(false);
  });

  it("stores the flag with the logout URL", async () => {
    await AppStorage.setOidcSession("https://idp.example.com/logout");
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "oidc_session",
      "true",
    );
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "oidc_logout_url",
      "https://idp.example.com/logout",
    );
  });

  it("clears a stale logout URL when the server reports none", async () => {
    await AppStorage.setOidcSession(null);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "oidc_session",
      "true",
    );
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("oidc_logout_url");
  });

  it("reads the logout URL", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("https://idp.example.com/out");
    expect(await AppStorage.getOidcLogoutUrl()).toBe(
      "https://idp.example.com/out",
    );
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("oidc_logout_url");
  });

  it("returns null for the logout URL on error", async () => {
    mockAsyncStorage.getItem.mockRejectedValue(new Error("fail"));
    expect(await AppStorage.getOidcLogoutUrl()).toBeNull();
  });

  it("deletes both keys together", async () => {
    await AppStorage.deleteOidcSession();
    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
      "oidc_session",
      "oidc_logout_url",
    ]);
  });
});

describe("AppStorage.playbackQueue", () => {
  it("gets the saved queue", async () => {
    mockAsyncStorage.getItem.mockResolvedValue('{"version":1}');
    expect(await AppStorage.getPlaybackQueue()).toBe('{"version":1}');
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("playback_queue");
  });

  it("returns null on error", async () => {
    mockAsyncStorage.getItem.mockRejectedValue(new Error("fail"));
    expect(await AppStorage.getPlaybackQueue()).toBeNull();
  });

  it("sets the saved queue", async () => {
    await AppStorage.setPlaybackQueue('{"version":1}');
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "playback_queue",
      '{"version":1}',
    );
  });

  it("deletes the saved queue", async () => {
    await AppStorage.deletePlaybackQueue();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("playback_queue");
  });
});
