jest.mock("@/lib/api/flow", () => ({
  getFlowStatus: jest.fn(),
  getPlaylistJobs: jest.fn(),
}));

jest.mock("@/lib/api/live-socket", () => require("@/test-support/live-socket"));

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
import { useIsFocused } from "expo-router/react-navigation";
import { useAuth } from "@/contexts/auth-context";
import { getFlowStatus, getPlaylistJobs } from "@/lib/api/flow";
import { useFlowStatus, usePlaylistJobs } from "@/hooks/flow/use-flow-status";
import { mockLive } from "@/test-support/live-socket";

const mockGetFlowStatus = getFlowStatus as jest.Mock;
const mockGetPlaylistJobs = getPlaylistJobs as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseFocusEffect = useFocusEffect as jest.Mock;
const mockUseIsFocused = useIsFocused as jest.Mock;

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
  mockLive.reset();
  mockUseIsFocused.mockReturnValue(true);
  mockUseAuth.mockReturnValue({ serverUrl: "http://test", token: "token" });
  mockGetFlowStatus.mockResolvedValue({ flows: [], jobs: [] });
  mockGetPlaylistJobs.mockResolvedValue([]);
});

async function pushStatus(status: object) {
  await act(async () =>
    mockLive.push({ channel: "playlists", type: "playlist_status", status }),
  );
}

async function wait(ms: number) {
  await act(async () => jest.advanceTimersByTime(ms));
}

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

describe("useFlowStatus with the socket", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("polls every 3s until the socket connects", async () => {
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useFlowStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await wait(3000);
    expect(mockGetFlowStatus).toHaveBeenCalledTimes(2);

    await act(async () => mockLive.setConnected(true));
    await wait(9000);
    expect(mockGetFlowStatus).toHaveBeenCalledTimes(2);
  });

  it("takes each pushed status as the screen's data", async () => {
    mockLive.setConnected(true);
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useFlowStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockLive.channels()).toEqual(["playlists"]);

    const pushed = { flows: [{ id: "flow-1" }], staticPlaylists: [] };
    await pushStatus(pushed);

    expect(result.current.data).toEqual(pushed);
    expect(mockGetFlowStatus).toHaveBeenCalledTimes(1);
  });

  it("doesn't listen while its screen is out of focus", async () => {
    // Aurral builds a status for each listener, so a tab left mounted behind
    // another mustn't keep one coming.
    mockUseIsFocused.mockReturnValue(false);
    mockLive.setConnected(true);
    const { wrapper } = makeWrapper();
    await renderHook(() => useFlowStatus(), { wrapper });

    expect(mockLive.channels()).toEqual([]);
  });
});

describe("usePlaylistJobs with the socket", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("rereads the tracks on each status push instead of polling", async () => {
    mockLive.setConnected(true);
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => usePlaylistJobs("flow-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await wait(9000);
    expect(mockGetPlaylistJobs).toHaveBeenCalledTimes(1);

    await pushStatus({ flows: [], staticPlaylists: [] });

    await waitFor(() => expect(mockGetPlaylistJobs).toHaveBeenCalledTimes(2));
    expect(mockGetPlaylistJobs).toHaveBeenLastCalledWith("flow-1");
  });
});
