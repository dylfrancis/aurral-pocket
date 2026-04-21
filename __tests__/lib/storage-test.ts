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
