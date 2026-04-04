jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { SecureStorage } from '@/lib/storage';

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(() => jest.clearAllMocks());

describe('SecureStorage.credentials', () => {
  it('gets credentials when both exist', async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('alice')
      .mockResolvedValueOnce('pass123');
    const result = await SecureStorage.getCredentials();
    expect(result).toEqual({ username: 'alice', password: 'pass123' });
  });

  it('returns null when username missing', async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('pass123');
    expect(await SecureStorage.getCredentials()).toBeNull();
  });

  it('returns null when password missing', async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce('alice')
      .mockResolvedValueOnce(null);
    expect(await SecureStorage.getCredentials()).toBeNull();
  });

  it('returns null on error', async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(new Error('fail'));
    expect(await SecureStorage.getCredentials()).toBeNull();
  });

  it('sets credentials', async () => {
    await SecureStorage.setCredentials('alice', 'pass123');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('saved_username', 'alice');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('saved_password', 'pass123');
  });

  it('deletes credentials', async () => {
    await SecureStorage.deleteCredentials();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('saved_username');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('saved_password');
  });
});

describe('SecureStorage.rememberCredentials', () => {
  it('returns true when stored as "true"', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('true');
    expect(await SecureStorage.getRememberCredentials()).toBe(true);
  });

  it('returns false when stored as "false"', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('false');
    expect(await SecureStorage.getRememberCredentials()).toBe(false);
  });

  it('returns false when not stored', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    expect(await SecureStorage.getRememberCredentials()).toBe(false);
  });

  it('sets remember credentials', async () => {
    await SecureStorage.setRememberCredentials(true);
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('remember_credentials', 'true');
  });

  it('deletes remember credentials', async () => {
    await SecureStorage.deleteRememberCredentials();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('remember_credentials');
  });
});

describe('SecureStorage.useBiometrics', () => {
  it('returns true when stored as "true"', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('true');
    expect(await SecureStorage.getUseBiometrics()).toBe(true);
  });

  it('returns false when not stored', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    expect(await SecureStorage.getUseBiometrics()).toBe(false);
  });

  it('sets biometrics preference', async () => {
    await SecureStorage.setUseBiometrics(true);
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('use_biometrics', 'true');
  });

  it('deletes biometrics preference', async () => {
    await SecureStorage.deleteUseBiometrics();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('use_biometrics');
  });
});

describe('SecureStorage.expiresAt', () => {
  it('gets expiry timestamp', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('1700000000000');
    expect(await SecureStorage.getExpiresAt()).toBe(1700000000000);
  });

  it('returns null when not stored', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    expect(await SecureStorage.getExpiresAt()).toBeNull();
  });

  it('returns null on error', async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(new Error('fail'));
    expect(await SecureStorage.getExpiresAt()).toBeNull();
  });

  it('sets expiry timestamp', async () => {
    await SecureStorage.setExpiresAt(1700000000000);
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'token_expires_at',
      '1700000000000',
    );
  });

  it('deletes expiry timestamp', async () => {
    await SecureStorage.deleteExpiresAt();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('token_expires_at');
  });
});
