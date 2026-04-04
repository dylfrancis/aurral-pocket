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

jest.mock('axios', () => {
  const interceptors = {
    request: { handlers: [] as any[], use: jest.fn() },
    response: { handlers: [] as any[], use: jest.fn() },
  };
  // Capture interceptor handlers when use() is called
  interceptors.request.use.mockImplementation((fulfilled, rejected) => {
    interceptors.request.handlers.push({ fulfilled, rejected });
    return interceptors.request.handlers.length - 1;
  });
  interceptors.response.use.mockImplementation((fulfilled, rejected) => {
    interceptors.response.handlers.push({ fulfilled, rejected });
    return interceptors.response.handlers.length - 1;
  });

  const instance = {
    defaults: { baseURL: '', headers: { 'Content-Type': 'application/json' } },
    interceptors,
    get: jest.fn(),
    post: jest.fn(),
  };

  return {
    __esModule: true,
    default: { create: jest.fn(() => instance) },
    AxiosError: class AxiosError extends Error {},
  };
});

import { ApiError, setAuthToken, setBaseUrl, api } from '@/lib/api/client';

describe('ApiError', () => {
  it('has correct properties', () => {
    const error = new ApiError(401, 'Unauthorized', { detail: 'bad token' });
    expect(error.status).toBe(401);
    expect(error.message).toBe('Unauthorized');
    expect(error.body).toEqual({ detail: 'bad token' });
    expect(error.isNetworkError).toBe(false);
    expect(error.name).toBe('ApiError');
    expect(error).toBeInstanceOf(Error);
  });

  it('identifies network errors with status 0', () => {
    const error = new ApiError(0, 'Network error');
    expect(error.isNetworkError).toBe(true);
  });

  it('non-network errors return false', () => {
    const error = new ApiError(500, 'Server error');
    expect(error.isNetworkError).toBe(false);
  });
});

describe('setBaseUrl', () => {
  afterEach(() => setBaseUrl(''));

  it('sets baseURL with /api suffix', () => {
    setBaseUrl('https://example.com');
    expect(api.defaults.baseURL).toBe('https://example.com/api');
  });

  it('clears baseURL when given empty string', () => {
    setBaseUrl('');
    expect(api.defaults.baseURL).toBe('');
  });
});

describe('setAuthToken + request interceptor', () => {
  afterEach(() => setAuthToken(null));

  it('attaches Bearer token to requests', () => {
    setAuthToken('test-token-123');

    const handlers = (api.interceptors.request as any).handlers;
    const handler = handlers.find((h: any) => h !== null);
    const config = { headers: {} } as any;
    const result = handler.fulfilled(config);

    expect(result.headers.Authorization).toBe('Bearer test-token-123');
  });

  it('does not attach token when null', () => {
    setAuthToken(null);

    const handlers = (api.interceptors.request as any).handlers;
    const handler = handlers.find((h: any) => h !== null);
    const config = { headers: {} } as any;
    const result = handler.fulfilled(config);

    expect(result.headers.Authorization).toBeUndefined();
  });
});
