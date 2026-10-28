jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "https://aurral.example" }),
}));

jest.mock("@/lib/api/health", () => ({
  getServerHealth: jest.fn(),
}));

import React from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getServerHealth } from "@/lib/api/health";
import { useServerFeatures } from "@/hooks/auth/use-server-features";
import { useServerHealth } from "@/hooks/auth/use-server-health";

const mockGetServerHealth = getServerHealth as jest.Mock;

const clients: QueryClient[] = [];

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

const bootstrap = {
  status: "ok",
  authRequired: true,
  onboardingRequired: false,
  timestamp: "2026-10-28T00:00:00Z",
  appVersion: "2.12.0",
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("useServerFeatures", () => {
  it("returns the features the server's bootstrap lists", async () => {
    mockGetServerHealth.mockResolvedValue({
      ...bootstrap,
      api: { version: 1, features: ["discover", "downloadCancel"] },
    });

    const { result } = await renderHook(() => useServerFeatures(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(result.current).toEqual(["discover", "downloadCancel"]),
    );
  });

  it("returns no features for a server that sends no api block", async () => {
    mockGetServerHealth.mockResolvedValue({
      ...bootstrap,
      appVersion: "2.10.0",
    });

    // Loading also reads as no features, so wait for bootstrap to land first.
    const { result } = await renderHook(
      () => ({ health: useServerHealth(), features: useServerFeatures() }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.health.isSuccess).toBe(true));
    expect(result.current.features).toEqual([]);
  });
});
