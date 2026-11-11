jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(() => ({
    setServer: jest.fn(),
  })),
}));

jest.mock("@/lib/api/client", () => ({
  setBaseUrl: jest.fn(),
  setCustomHeaders: jest.fn(),
}));

jest.mock("@/lib/api/health", () => ({
  checkServerLive: jest.fn(),
  getServerHealth: jest.fn(),
  SUPPORTED_API_VERSION: 1,
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
import { setBaseUrl, setCustomHeaders } from "@/lib/api/client";
import { checkServerLive, getServerHealth } from "@/lib/api/health";
import { useAuth } from "@/contexts/auth-context";
import { useServerConnect } from "@/hooks/auth/use-server-connect";

const mockSetBaseUrl = setBaseUrl as jest.Mock;
const mockSetCustomHeaders = setCustomHeaders as jest.Mock;
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

    const result = await config.mutationFn({
      url: "  https://example.com///  ",
      headers: {},
    });
    expect(mockSetBaseUrl).toHaveBeenCalledWith("https://example.com");
    expect(result).toEqual({
      url: "https://example.com",
      health: { authRequired: true },
      headers: {},
    });
  });

  it("calls checkServerLive then getServerHealth", async () => {
    mockCheckServerLive.mockResolvedValue(undefined);
    mockGetServerHealth.mockResolvedValue({ authRequired: false });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    await config.mutationFn({ url: "https://server.com", headers: {} });

    expect(mockCheckServerLive).toHaveBeenCalled();
    expect(mockGetServerHealth).toHaveBeenCalled();
  });

  it("connects to a server on API version 1", async () => {
    mockCheckServerLive.mockResolvedValue(undefined);
    mockGetServerHealth.mockResolvedValue({
      authRequired: true,
      api: { version: 1, features: [] },
    });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    await expect(
      config.mutationFn({ url: "https://server.com", headers: {} }),
    ).resolves.toEqual(expect.objectContaining({ url: "https://server.com" }));
  });

  it("refuses a server on a newer API version", async () => {
    mockCheckServerLive.mockResolvedValue(undefined);
    mockGetServerHealth.mockResolvedValue({
      authRequired: true,
      api: { version: 2, features: [] },
    });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    await expect(
      config.mutationFn({ url: "https://server.com", headers: {} }),
    ).rejects.toThrow("This server is newer than Aurral Pocket supports.");
  });

  it("sends the custom headers with the health check, so a proxy lets it through", async () => {
    const headers = { "CF-Access-Client-Id": "id.access" };
    mockCheckServerLive.mockResolvedValue(undefined);
    mockGetServerHealth.mockResolvedValue({ authRequired: true });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;
    await config.mutationFn({ url: "https://server.com", headers });

    expect(mockSetCustomHeaders).toHaveBeenCalledWith(headers);
    expect(mockSetCustomHeaders.mock.invocationCallOrder[0]).toBeLessThan(
      mockCheckServerLive.mock.invocationCallOrder[0],
    );
  });

  it("calls setServer on success", () => {
    const mockSetServer = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({ setServer: mockSetServer });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onSuccess({
      url: "https://server.com",
      health: { authRequired: true },
      headers: { "CF-Access-Client-Id": "id.access" },
    });

    expect(mockSetServer).toHaveBeenCalledWith(
      "https://server.com",
      { authRequired: true },
      { "CF-Access-Client-Id": "id.access" },
    );
  });

  it("forgets the server and its headers on error", () => {
    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onError();

    expect(mockSetBaseUrl).toHaveBeenCalledWith("");
    expect(mockSetCustomHeaders).toHaveBeenCalledWith({});
  });
});
