jest.mock("@/lib/api/client", () => ({
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

jest.mock("@/lib/date-time", () => ({
  setDateTimeFormat: jest.fn(),
}));

import { api } from "@/lib/api/client";
import { setDateTimeFormat } from "@/lib/date-time";
import { checkServerLive, getServerHealth } from "@/lib/api/health";

const mockGet = api.get as jest.Mock;
const mockSetDateTimeFormat = setDateTimeFormat as jest.Mock;

beforeEach(() => {
  mockGet.mockReset();
  mockSetDateTimeFormat.mockClear();
});

describe("checkServerLive", () => {
  it("calls GET /health/live with 10s timeout", async () => {
    mockGet.mockResolvedValue({ data: { status: "ok" } });

    const result = await checkServerLive();

    expect(mockGet).toHaveBeenCalledWith("/health/live", { timeout: 10_000 });
    expect(result).toEqual({ status: "ok" });
  });

  it("propagates errors", async () => {
    mockGet.mockRejectedValue(new Error("timeout"));
    await expect(checkServerLive()).rejects.toThrow("timeout");
  });
});

describe("getServerHealth", () => {
  it("calls GET /health and returns data", async () => {
    const health = {
      status: "ok",
      authRequired: true,
      onboardingRequired: false,
      timestamp: "2026-03-29T00:00:00Z",
    };
    mockGet.mockResolvedValue({ data: health });

    const result = await getServerHealth();

    expect(mockGet).toHaveBeenCalledWith("/health");
    expect(result).toEqual(health);
  });

  it("adopts the date and time format the server sends", async () => {
    mockGet.mockResolvedValue({
      data: {
        status: "ok",
        authRequired: true,
        onboardingRequired: false,
        timestamp: "2026-03-29T00:00:00Z",
        dateTimeFormat: "day-first",
      },
    });

    await getServerHealth();

    expect(mockSetDateTimeFormat).toHaveBeenCalledWith("day-first");
  });

  it("passes an absent format through, so it normalizes to browser", async () => {
    mockGet.mockResolvedValue({
      data: {
        status: "ok",
        authRequired: true,
        onboardingRequired: false,
        timestamp: "2026-03-29T00:00:00Z",
      },
    });

    await getServerHealth();

    expect(mockSetDateTimeFormat).toHaveBeenCalledWith(undefined);
  });
});
