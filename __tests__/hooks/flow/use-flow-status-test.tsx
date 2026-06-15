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
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { getFlowStatus } from "@/lib/api/flow";
import { useFlowStatus } from "@/hooks/flow/use-flow-status";

const mockGetFlowStatus = getFlowStatus as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseFocusEffect = useFocusEffect as jest.Mock;

function latestFocusEffect(): () => void {
  return mockUseFocusEffect.mock.calls.at(-1)![0];
}

function makeWrapper() {
  const client = new QueryClient({
    // notifyOnChangeProps: "all" — useFlowStatus only reads `refetch` during
    // render, so React Query's tracked-queries would skip the re-render when
    // data lands. Under RNTL v14 the fetch resolves during the async
    // renderHook() flush, before the test reads isSuccess, so without this the
    // observer never re-renders and the query looks stuck pending.
    defaultOptions: {
      queries: { retry: false, gcTime: 0, notifyOnChangeProps: "all" },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { wrapper: Wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ serverUrl: "http://test", token: "token" });
  mockGetFlowStatus.mockResolvedValue({ flows: [], jobs: [] });
});

describe("useFlowStatus", () => {
  it("fetches once on mount", async () => {
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useFlowStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetFlowStatus).toHaveBeenCalledTimes(1);
  });

  it("refetches immediately when the screen regains focus", async () => {
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useFlowStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(() => latestFocusEffect()()); // initial focus — skipped
    expect(mockGetFlowStatus).toHaveBeenCalledTimes(1);

    await act(() => latestFocusEffect()()); // user returns to the tab
    await waitFor(() => expect(mockGetFlowStatus).toHaveBeenCalledTimes(2));
  });

  it("does not refetch on focus while unauthenticated", async () => {
    mockUseAuth.mockReturnValue({ serverUrl: null, token: null });
    const { wrapper } = makeWrapper();
    await renderHook(() => useFlowStatus(), { wrapper });

    await act(() => latestFocusEffect()()); // initial focus — skipped
    await act(() => latestFocusEffect()()); // refocus, but disabled

    expect(mockGetFlowStatus).not.toHaveBeenCalled();
  });
});
