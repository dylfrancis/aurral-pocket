jest.mock('@/lib/api/client', () => ({
  api: { post: jest.fn(), get: jest.fn() },
  ApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  setBaseUrl: jest.fn(),
  setAuthToken: jest.fn(),
}));

import { api } from '@/lib/api/client';
import { login, getMe, logout } from '@/lib/api/auth';

const mockPost = api.post as jest.Mock;
const mockGet = api.get as jest.Mock;

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

const mockUser = {
  id: 1,
  username: 'admin',
  role: 'admin' as const,
  permissions: { addArtist: true, addAlbum: true },
};

describe('login', () => {
  it('posts credentials and returns token + user', async () => {
    const response = { token: 'abc123', expiresAt: 1700000000000, user: mockUser };
    mockPost.mockResolvedValue({ data: response });

    const result = await login({ username: 'admin', password: 'pass' });

    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      username: 'admin',
      password: 'pass',
    });
    expect(result).toEqual(response);
  });
});

describe('getMe', () => {
  it('fetches current user session', async () => {
    const response = { user: mockUser, expiresAt: 1700000000000 };
    mockGet.mockResolvedValue({ data: response });

    const result = await getMe();

    expect(mockGet).toHaveBeenCalledWith('/auth/me');
    expect(result).toEqual(response);
  });
});

describe('logout', () => {
  it('posts to logout endpoint', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });

    const result = await logout();

    expect(mockPost).toHaveBeenCalledWith('/auth/logout');
    expect(result).toEqual({ success: true });
  });
});
