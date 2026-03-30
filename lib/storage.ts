import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SERVER_URL: 'server_url',
  AUTH_TOKEN: 'auth_token',
  USER: 'user_json',
} as const;

export const SecureStorage = {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.AUTH_TOKEN);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.AUTH_TOKEN, token);
    } catch {}
  },

  async deleteToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.AUTH_TOKEN);
    } catch {}
  },

  async getUser(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.USER);
    } catch {
      return null;
    }
  },

  async setUser(userJson: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.USER, userJson);
    } catch {}
  },

  async deleteUser(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.USER);
    } catch {}
  },
};

export const AppStorage = {
  async getServerUrl(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.SERVER_URL);
    } catch {
      return null;
    }
  },

  async setServerUrl(url: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SERVER_URL, url);
    } catch {}
  },

  async deleteServerUrl(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEYS.SERVER_URL);
    } catch {}
  },
};
