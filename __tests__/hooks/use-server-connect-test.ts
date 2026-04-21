jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(() => ({
    setServer: jest.fn(),
  })),
}));

jest.mock("@/lib/api/client", () => ({
  setBaseUrl: jest.fn(),
}));

jest.mock("@/lib/api/health", () => ({
  checkServerLive: jest.fn(),
  getServerHealth: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn((config: any) => {
    return {
      config,
      mutateAsync: config.mutationFn,
    };
  }),
}));

import { useMutation } from "@tanstack/react-query";
import { setBaseUrl } from "@/lib/api/client";
import { checkServerLive, getServerHealth } from "@/lib/api/health";
import { useAuth } from "@/contexts/auth-context";
import { useServerConnect } from "@/hooks/auth/use-server-connect";

const mockSetBaseUrl = setBaseUrl as jest.Mock;
const mockCheckServerLive = checkServerLive as jest.Mock;
const mockGetServerHealth = getServerHealth as jest.Mock;
const mockUseMutation = useMutation as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMutation.mockImplementation((config: any) => ({
    config,
    mutateAsync: config.mutationFn,
  }));
});

describe("useServerConnect", () => {
  it("normalizes URL by trimming and removing trailing slashes", async () => {
    mockCheckServerLive.mockResolvedValue(undefined);
    mockGetServerHealth.mockResolvedValue({ authRequired: true });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    const result = await config.mutationFn("  https://example.com///  ");
    expect(mockSetBaseUrl).toHaveBeenCalledWith("https://example.com");
    expect(result).toEqual({
      url: "https://example.com",
      health: { authRequired: true },
    });
  });

  it("calls checkServerLive then getServerHealth", async () => {
    mockCheckServerLive.mockResolvedValue(undefined);
    mockGetServerHealth.mockResolvedValue({ authRequired: false });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    await config.mutationFn("https://server.com");

    expect(mockCheckServerLive).toHaveBeenCalled();
    expect(mockGetServerHealth).toHaveBeenCalled();
  });

  it("calls setServer on success", () => {
    const mockSetServer = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({ setServer: mockSetServer });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess({
      url: "https://server.com",
      health: { authRequired: true },
    });

    expect(mockSetServer).toHaveBeenCalledWith("https://server.com", {
      authRequired: true,
    });
  });

  it("clears base URL on error", () => {
    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onError();

    expect(mockSetBaseUrl).toHaveBeenCalledWith("");
  });
});
