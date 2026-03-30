jest.mock('@/lib/api/client', () => ({
  api: { get: jest.fn() },
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
import { checkServerLive, getServerHealth } from '@/lib/api/health';

const mockGet = api.get as jest.Mock;

beforeEach(() => mockGet.mockReset());

describe('checkServerLive', () => {
  it('calls GET /health/live with 5s timeout', async () => {
    mockGet.mockResolvedValue({ data: { status: 'ok' } });

    const result = await checkServerLive();

    expect(mockGet).toHaveBeenCalledWith('/health/live', { timeout: 5000 });
    expect(result).toEqual({ status: 'ok' });
  });

  it('propagates errors', async () => {
    mockGet.mockRejectedValue(new Error('timeout'));
    await expect(checkServerLive()).rejects.toThrow('timeout');
  });
});

describe('getServerHealth', () => {
  it('calls GET /health and returns data', async () => {
    const health = {
      status: 'ok',
      authRequired: true,
      onboardingRequired: false,
      timestamp: '2026-03-29T00:00:00Z',
    };
    mockGet.mockResolvedValue({ data: health });

    const result = await getServerHealth();

    expect(mockGet).toHaveBeenCalledWith('/health');
    expect(result).toEqual(health);
  });
});
