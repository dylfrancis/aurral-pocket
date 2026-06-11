jest.mock("@/lib/api/flow", () => ({
  getFlowStatus: jest.fn(),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(() => ({ serverUrl: "http://test", token: "token" })),
}));

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock("expo-router/react-navigation", () => ({
  useIsFocused: jest.fn(() => true),
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getFlowStatus } from "@/lib/api/flow";
import { useEditSnapshot } from "@/hooks/flow/use-edit-snapshot";
import { flowKeys } from "@/lib/query-keys";
import type { Flow, FlowStatusSnapshot } from "@/lib/types/flow";

const mockGetFlowStatus = getFlowStatus as jest.Mock;

const flow: Flow = {
  id: "flow-1",
  name: "Morning Mix",
  enabled: true,
  size: 30,
  mix: { discover: 50, mix: 30, trending: 20, focus: 0 },
  deepDive: false,
  tags: [],
  relatedArtists: [],
  scheduleDays: [1, 3],
  scheduleTime: "09:00",
  nextRunAt: null,
};

const status = {
  flows: [flow],
  sharedPlaylists: [],
  jobs: [],
} as unknown as FlowStatusSnapshot;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { client, wrapper: Wrapper };
}

const selectFlow = (s: FlowStatusSnapshot) =>
  s.flows.find((f) => f.id === "flow-1");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useEditSnapshot", () => {
  it("resolves synchronously from a warm cache without fetching", () => {
    const { client, wrapper } = makeWrapper();
    client.setQueryData(flowKeys.status(), status);

    const { result } = renderHook(() => useEditSnapshot(true, selectFlow), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.snapshot).toEqual(flow);
    expect(mockGetFlowStatus).not.toHaveBeenCalled();
  });

  it("does not update the snapshot when fresh status data lands in the cache", () => {
    const { client, wrapper } = makeWrapper();
    client.setQueryData(flowKeys.status(), status);

    const { result } = renderHook(() => useEditSnapshot(true, selectFlow), {
      wrapper,
    });

    act(() => {
      client.setQueryData(flowKeys.status(), {
        ...status,
        flows: [{ ...flow, name: "Renamed", scheduleTime: "21:00" }],
      });
    });

    expect(result.current.snapshot).toEqual(flow);
  });

  it("fetches once when the cache is cold", async () => {
    mockGetFlowStatus.mockResolvedValue(status);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useEditSnapshot(true, selectFlow), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.snapshot).toEqual(flow);
    expect(mockGetFlowStatus).toHaveBeenCalledTimes(1);
  });

  it("settles with no snapshot when the cold fetch fails", async () => {
    mockGetFlowStatus.mockRejectedValue(new Error("network down"));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useEditSnapshot(true, selectFlow), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.snapshot).toBeUndefined();
  });

  it("does nothing when disabled", () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useEditSnapshot(false, selectFlow), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.snapshot).toBeUndefined();
    expect(mockGetFlowStatus).not.toHaveBeenCalled();
  });
});
