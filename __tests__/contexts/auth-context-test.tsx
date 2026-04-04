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

jest.mock('@/lib/api/client', () => ({
  setAuthToken: jest.fn(),
  setBaseUrl: jest.fn(),
  setOnSessionExpired: jest.fn(),
  setOnAuthRefreshed: jest.fn(),
}));

jest.mock('@/lib/api/auth', () => ({
  login: jest.fn(),
}));

import React, { useCallback } from 'react';
import { Text, Pressable } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { setAuthToken, setBaseUrl } from '@/lib/api/client';
import { login } from '@/lib/api/auth';

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockLogin = login as jest.Mock;

// Interactive consumer that exposes context state and actions
function TestConsumer() {
  const auth = useAuth();

  const handleSetAuth = useCallback(async () => {
    await auth.setAuth(
      'new-token',
      { id: 1, username: 'alice', role: 'user', permissions: {} },
      Date.now() + 86400000,
    );
  }, [auth]);

  const handleSaveCredentials = useCallback(async () => {
    await auth.saveCredentials('alice', 'pass123');
  }, [auth]);

  const handleRememberOn = useCallback(async () => {
    await auth.setRememberCredentials(true);
  }, [auth]);

  const handleRememberOff = useCallback(async () => {
    await auth.setRememberCredentials(false);
  }, [auth]);

  const handleBiometricsOn = useCallback(async () => {
    await auth.setUseBiometrics(true);
  }, [auth]);

  const handleBiometricsOff = useCallback(async () => {
    await auth.setUseBiometrics(false);
  }, [auth]);

  const handleClearAll = useCallback(async () => {
    await auth.clearAll();
  }, [auth]);

  return (
    <>
      <Text testID="token">{auth.token ?? 'null'}</Text>
      <Text testID="serverUrl">{auth.serverUrl ?? 'null'}</Text>
      <Text testID="user">{auth.user?.username ?? 'null'}</Text>
      <Text testID="sessionExpired">{String(auth.sessionExpired)}</Text>
      <Text testID="rememberCredentials">{String(auth.rememberCredentials)}</Text>
      <Text testID="useBiometrics">{String(auth.useBiometrics)}</Text>
      <Text testID="hasCredentials">{String(auth.hasCredentials)}</Text>
      <Pressable testID="setAuth" onPress={handleSetAuth} />
      <Pressable testID="saveCredentials" onPress={handleSaveCredentials} />
      <Pressable testID="rememberOn" onPress={handleRememberOn} />
      <Pressable testID="rememberOff" onPress={handleRememberOff} />
      <Pressable testID="biometricsOn" onPress={handleBiometricsOn} />
      <Pressable testID="biometricsOff" onPress={handleBiometricsOff} />
      <Pressable testID="clearAll" onPress={handleClearAll} />
    </>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockSecureStore.getItemAsync.mockResolvedValue(null);
  mockAsyncStorage.getItem.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AuthProvider — restore on mount', () => {
  it('restores token, user, and server URL', async () => {
    mockAsyncStorage.getItem.mockResolvedValue('https://my-server.com');
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'auth_token') return 'my-token';
      if (key === 'user_json') return '{"id":1,"username":"alice","role":"user"}';
      return null;
    });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('my-token');
      expect(getByTestId('serverUrl').props.children).toBe('https://my-server.com');
      expect(getByTestId('user').props.children).toBe('alice');
    });

    expect(setBaseUrl).toHaveBeenCalledWith('https://my-server.com');
    expect(setAuthToken).toHaveBeenCalledWith('my-token');
  });

  it('starts with null state when nothing stored', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('null');
      expect(getByTestId('serverUrl').props.children).toBe('null');
    });
  });
});

describe('AuthProvider — 30-day inactivity hard expire', () => {
  const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;

  it('clears all data when inactive for more than 30 days', async () => {
    const oldTimestamp = String(Date.now() - THIRTY_ONE_DAYS_MS);

    mockAsyncStorage.getItem.mockResolvedValue('https://my-server.com');
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'auth_token') return 'old-token';
      if (key === 'user_json') return '{"id":1,"username":"alice","role":"user"}';
      if (key === 'last_active_at') return oldTimestamp;
      return null;
    });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('null');
      expect(getByTestId('serverUrl').props.children).toBe('null');
      expect(getByTestId('user').props.children).toBe('null');
    });

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('user_json');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('saved_username');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('saved_password');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('remember_credentials');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('use_biometrics');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('token_expires_at');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('last_active_at');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('server_url');
  });

  it('restores normally when active within 30 days', async () => {
    const recentTimestamp = String(Date.now() - 5 * 24 * 60 * 60 * 1000);

    mockAsyncStorage.getItem.mockResolvedValue('https://my-server.com');
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'auth_token') return 'valid-token';
      if (key === 'user_json') return '{"id":1,"username":"bob","role":"admin"}';
      if (key === 'last_active_at') return recentTimestamp;
      return null;
    });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('valid-token');
      expect(getByTestId('user').props.children).toBe('bob');
    });

    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('restores normally when lastActiveAt is not set (fresh install)', async () => {
    mockAsyncStorage.getItem.mockResolvedValue('https://my-server.com');
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'auth_token') return 'fresh-token';
      if (key === 'user_json') return '{"id":1,"username":"carol","role":"user"}';
      return null;
    });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('fresh-token');
      expect(getByTestId('user').props.children).toBe('carol');
    });
  });
});

describe('AuthProvider — setAuth bumps lastActiveAt', () => {
  it('writes lastActiveAt to storage on setAuth', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('null');
    });

    await act(async () => {
      fireEvent.press(getByTestId('setAuth'));
    });

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('new-token');
    });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'last_active_at',
      expect.stringMatching(/^\d+$/),
    );
  });
});

describe('AuthProvider — credential clearing logic', () => {
  it('does not clear credentials when turning off remember if biometrics is on', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('null');
    });

    // Enable biometrics first, then remember
    await act(async () => {
      fireEvent.press(getByTestId('biometricsOn'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('rememberOn'));
    });

    jest.clearAllMocks();

    // Turn off remember — credentials should NOT be deleted because biometrics is still on
    await act(async () => {
      fireEvent.press(getByTestId('rememberOff'));
    });

    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalledWith('saved_username');
    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalledWith('saved_password');
  });

  it('does not clear credentials when turning off biometrics if remember is on', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('null');
    });

    await act(async () => {
      fireEvent.press(getByTestId('rememberOn'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('biometricsOn'));
    });

    jest.clearAllMocks();

    // Turn off biometrics — credentials should NOT be deleted because remember is still on
    await act(async () => {
      fireEvent.press(getByTestId('biometricsOff'));
    });

    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalledWith('saved_username');
    expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalledWith('saved_password');
  });

  it('clears credentials when both remember and biometrics are off', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('null');
    });

    // Enable remember, then turn it off (biometrics already off)
    await act(async () => {
      fireEvent.press(getByTestId('rememberOn'));
    });

    jest.clearAllMocks();

    await act(async () => {
      fireEvent.press(getByTestId('rememberOff'));
    });

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('saved_username');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('saved_password');
  });
});

describe('AuthProvider — saveCredentials conditional', () => {
  it('does not save when neither remember nor biometrics is enabled', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('rememberCredentials').props.children).toBe('false');
      expect(getByTestId('useBiometrics').props.children).toBe('false');
    });

    await act(async () => {
      fireEvent.press(getByTestId('saveCredentials'));
    });

    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalledWith('saved_username', 'alice');
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalledWith('saved_password', 'pass123');
  });

  it('saves when remember is enabled', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('null');
    });

    await act(async () => {
      fireEvent.press(getByTestId('rememberOn'));
    });

    jest.clearAllMocks();

    await act(async () => {
      fireEvent.press(getByTestId('saveCredentials'));
    });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('saved_username', 'alice');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('saved_password', 'pass123');
  });

  it('saves when biometrics is enabled (even without remember)', async () => {
    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('null');
    });

    await act(async () => {
      fireEvent.press(getByTestId('biometricsOn'));
    });

    jest.clearAllMocks();

    await act(async () => {
      fireEvent.press(getByTestId('saveCredentials'));
    });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('saved_username', 'alice');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('saved_password', 'pass123');
  });
});

describe('AuthProvider — clearAll', () => {
  it('clears all state and storage including lastActiveAt', async () => {
    mockAsyncStorage.getItem.mockResolvedValue('https://my-server.com');
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'auth_token') return 'my-token';
      if (key === 'user_json') return '{"id":1,"username":"alice","role":"user"}';
      return null;
    });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('my-token');
    });

    jest.clearAllMocks();

    await act(async () => {
      fireEvent.press(getByTestId('clearAll'));
    });

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('null');
      expect(getByTestId('serverUrl').props.children).toBe('null');
      expect(getByTestId('user').props.children).toBe('null');
    });

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('last_active_at');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('token_expires_at');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('saved_username');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('saved_password');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('server_url');
  });
});

describe('AuthProvider — proactive expiry timer', () => {
  it('triggers sessionExpired when token expires and no remember', async () => {
    const expiresIn = 120_000; // 2 minutes from now
    const expiresAt = String(Date.now() + expiresIn);

    mockAsyncStorage.getItem.mockResolvedValue('https://my-server.com');
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'auth_token') return 'my-token';
      if (key === 'user_json') return '{"id":1,"username":"alice","role":"user"}';
      if (key === 'token_expires_at') return expiresAt;
      if (key === 'remember_credentials') return null;
      return null;
    });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('my-token');
      expect(getByTestId('sessionExpired').props.children).toBe('false');
    });

    // Timer fires 60s before expiry, so at expiresIn - 60000 = 60000ms
    await act(async () => {
      jest.advanceTimersByTime(expiresIn);
    });

    await waitFor(() => {
      expect(getByTestId('sessionExpired').props.children).toBe('true');
    });
  });

  it('silently re-auths when token expires and remember is on', async () => {
    // Use real timers for this test since the timer callback has async/await
    jest.useRealTimers();

    // 61s from now — timer fires at expiresIn - 60s = 1s
    const expiresIn = 61_000;
    const expiresAt = String(Date.now() + expiresIn);
    const newExpiresAt = Date.now() + expiresIn + 86400000;

    mockAsyncStorage.getItem.mockResolvedValue('https://my-server.com');
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'auth_token') return 'my-token';
      if (key === 'user_json') return '{"id":1,"username":"alice","role":"user"}';
      if (key === 'token_expires_at') return expiresAt;
      if (key === 'remember_credentials') return 'true';
      if (key === 'saved_username') return 'alice';
      if (key === 'saved_password') return 'pass123';
      return null;
    });

    mockLogin.mockResolvedValue({
      token: 'renewed-token',
      expiresAt: newExpiresAt,
      user: { id: 1, username: 'alice', role: 'user' },
    });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('my-token');
    });

    // Timer fires at ~1s (61s - 60s buffer). Wait for re-auth to complete.
    await waitFor(
      () => {
        expect(getByTestId('sessionExpired').props.children).toBe('false');
        expect(getByTestId('token').props.children).toBe('renewed-token');
      },
      { timeout: 5000 },
    );

    jest.useFakeTimers();
  });

  it('fires immediately when token is already expired on restore', async () => {
    const expiredAt = String(Date.now() - 60_000); // expired 1 minute ago

    mockAsyncStorage.getItem.mockResolvedValue('https://my-server.com');
    mockSecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'auth_token') return 'expired-token';
      if (key === 'user_json') return '{"id":1,"username":"alice","role":"user"}';
      if (key === 'token_expires_at') return expiredAt;
      if (key === 'remember_credentials') return null;
      return null;
    });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('token').props.children).toBe('expired-token');
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(getByTestId('sessionExpired').props.children).toBe('true');
    });
  });
});
