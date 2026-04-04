import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SERVER_URL: 'server_url',
  AUTH_TOKEN: 'auth_token',
  USER: 'user_json',
  SAVED_USERNAME: 'saved_username',
  SAVED_PASSWORD: 'saved_password',
  REMEMBER_CREDENTIALS: 'remember_credentials',
  USE_BIOMETRICS: 'use_biometrics',
  EXPIRES_AT: 'token_expires_at',
  LAST_ACTIVE_AT: 'last_active_at',
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

  async getExpiresAt(): Promise<number | null> {
    try {
      const val = await SecureStore.getItemAsync(KEYS.EXPIRES_AT);
      return val ? Number(val) : null;
    } catch {
      return null;
    }
  },

  async setExpiresAt(ms: number): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.EXPIRES_AT, String(ms));
    } catch {}
  },

  async deleteExpiresAt(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.EXPIRES_AT);
    } catch {}
  },

  async getLastActiveAt(): Promise<number | null> {
    try {
      const val = await SecureStore.getItemAsync(KEYS.LAST_ACTIVE_AT);
      return val ? Number(val) : null;
    } catch {
      return null;
    }
  },

  async setLastActiveAt(ms: number): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.LAST_ACTIVE_AT, String(ms));
    } catch {}
  },

  async deleteLastActiveAt(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.LAST_ACTIVE_AT);
    } catch {}
  },

  async getCredentials(): Promise<{ username: string; password: string } | null> {
    try {
      const [username, password] = await Promise.all([
        SecureStore.getItemAsync(KEYS.SAVED_USERNAME),
        SecureStore.getItemAsync(KEYS.SAVED_PASSWORD),
      ]);
      if (username && password) return { username, password };
      return null;
    } catch {
      return null;
    }
  },

  async setCredentials(username: string, password: string): Promise<void> {
    try {
      await Promise.all([
        SecureStore.setItemAsync(KEYS.SAVED_USERNAME, username),
        SecureStore.setItemAsync(KEYS.SAVED_PASSWORD, password),
      ]);
    } catch {}
  },

  async deleteCredentials(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.SAVED_USERNAME),
        SecureStore.deleteItemAsync(KEYS.SAVED_PASSWORD),
      ]);
    } catch {}
  },

  async getRememberCredentials(): Promise<boolean> {
    try {
      return (await SecureStore.getItemAsync(KEYS.REMEMBER_CREDENTIALS)) === 'true';
    } catch {
      return false;
    }
  },

  async setRememberCredentials(value: boolean): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.REMEMBER_CREDENTIALS, String(value));
    } catch {}
  },

  async deleteRememberCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.REMEMBER_CREDENTIALS);
    } catch {}
  },

  async getUseBiometrics(): Promise<boolean> {
    try {
      return (await SecureStore.getItemAsync(KEYS.USE_BIOMETRICS)) === 'true';
    } catch {
      return false;
    }
  },

  async setUseBiometrics(value: boolean): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.USE_BIOMETRICS, String(value));
    } catch {}
  },

  async deleteUseBiometrics(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.USE_BIOMETRICS);
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
