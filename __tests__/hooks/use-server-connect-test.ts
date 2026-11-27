jest.mock("@/lib/api/client", () => ({
  setBaseUrl: jest.fn(),
  setCustomHeaders: jest.fn(),
}));

jest.mock("@/lib/api/health", () => ({
  checkServerLive: jest.fn(),
  getServerHealth: jest.fn(),
  SUPPORTED_API_VERSION: 2,
}));

jest.mock("@/lib/tailscale", () => ({
  startGateway: jest.fn(() => Promise.resolve("http://127.0.0.1:47862")),
  stopGateway: jest.fn(() => Promise.resolve()),
  waitForTailnet: jest.fn(() => Promise.resolve()),
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
import { useServerConnect } from "@/hooks/auth/use-server-connect";
import { startGateway, stopGateway, waitForTailnet } from "@/lib/tailscale";

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
      tailscale: null,
    });
  });

  it("joins the tailnet, then checks the server through the gateway", async () => {
    mockCheckServerLive.mockResolvedValue(undefined);
    mockGetServerHealth.mockResolvedValue({ authRequired: true });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;
    const signal = new AbortController().signal;
    const result = await config.mutationFn({
      url: "http://aurral-host:3002/",
      headers: {},
      tailscale: { authKey: "tskey-auth-1", controlURL: "https://hs.example" },
      signal,
    });

    expect(startGateway).toHaveBeenCalledWith(
      "http://aurral-host:3002",
      { controlURL: "https://hs.example" },
      "tskey-auth-1",
    );
    expect(mockSetBaseUrl).toHaveBeenCalledWith("http://127.0.0.1:47862");
    expect(waitForTailnet).toHaveBeenCalledWith({ signal, usingAuthKey: true });
    expect(
      (waitForTailnet as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan(mockCheckServerLive.mock.invocationCallOrder[0]);
    // The key isn't saved: the node keeps its own credentials.
    expect(result).toEqual({
      url: "http://aurral-host:3002",
      health: { authRequired: true },
      headers: {},
      tailscale: { controlURL: "https://hs.example" },
    });
  });

  it("checks no server when the tailnet can't be joined", async () => {
    (waitForTailnet as jest.Mock).mockRejectedValueOnce(
      new Error("Tailscale sign-in wasn't finished."),
    );

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    await expect(
      config.mutationFn({
        url: "http://aurral-host:3002",
        headers: {},
        tailscale: {},
      }),
    ).rejects.toThrow("Tailscale sign-in wasn't finished.");
    expect(mockCheckServerLive).not.toHaveBeenCalled();
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

  it("connects to a server on API version 2", async () => {
    mockCheckServerLive.mockResolvedValue(undefined);
    mockGetServerHealth.mockResolvedValue({
      authRequired: true,
      api: { version: 2, features: [] },
    });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    await expect(
      config.mutationFn({ url: "https://server.com", headers: {} }),
    ).resolves.toEqual(expect.objectContaining({ url: "https://server.com" }));
  });

  it.each([
    [3, "This server is newer than Aurral Pocket supports."],
    [1, "This server runs an older Aurral than Aurral Pocket supports."],
  ])("refuses a server on API version %i", async (version, message) => {
    mockCheckServerLive.mockResolvedValue(undefined);
    mockGetServerHealth.mockResolvedValue({
      authRequired: true,
      api: { version, features: [] },
    });

    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    await expect(
      config.mutationFn({ url: "https://server.com", headers: {} }),
    ).rejects.toThrow(message);
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

  it("forgets the server, its headers and the gateway on error", () => {
    useServerConnect();
    const { config } = mockUseMutation.mock.results[0].value;

    config.onError();

    expect(mockSetBaseUrl).toHaveBeenCalledWith("");
    expect(mockSetCustomHeaders).toHaveBeenCalledWith({});
    expect(stopGateway).toHaveBeenCalled();
  });
});
