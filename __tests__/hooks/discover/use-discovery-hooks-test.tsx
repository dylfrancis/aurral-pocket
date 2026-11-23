jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/lib/api/search", () => ({
  getDiscovery: jest.fn(),
  getRecentlyAdded: jest.fn(),
  getRecentReleases: jest.fn(),
  getNearbyShows: jest.fn(),
}));

import React from "react";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getDiscovery,
  getRecentlyAdded,
  getRecentReleases,
  getNearbyShows,
} from "@/lib/api/search";
import {
  useDiscovery,
  useRecentlyAdded,
  useRecentReleases,
  useNearbyShows,
} from "@/hooks/discover";

const mockGetDiscovery = getDiscovery as jest.Mock;
const mockGetRecentlyAdded = getRecentlyAdded as jest.Mock;
const mockGetRecentReleases = getRecentReleases as jest.Mock;
const mockGetNearbyShows = getNearbyShows as jest.Mock;

// The discover hooks set their own multi-hour gcTime, which overrides the
// gcTime: 0 default below. React Query arms a setTimeout(gcTime) per cache entry
// once its last observer unmounts, so without an explicit clear() each test
// leaves a 30-60 minute timer holding the event loop open and Jest never exits.
const clients: QueryClient[] = [];

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  clients.push(client);
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { wrapper: Wrapper, client };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Unmount before clearing: Jest runs same-level afterEach hooks in reverse
  // registration order, so the library's own cleanup would otherwise run after
  // this one and re-arm the gc timers that clear() just dropped.
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("useDiscovery", () => {
  it("calls getDiscovery and returns the response", async () => {
    const data = {
      recommendations: [],
      globalTop: [],
      basedOn: [],
      topTags: [],
      topGenres: [],
      lastUpdated: null,
      configured: true,
    };
    mockGetDiscovery.mockResolvedValue(data);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useDiscovery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(mockGetDiscovery).toHaveBeenCalledTimes(1);
  });
});

describe("useRecentlyAdded", () => {
  it("calls getRecentlyAdded", async () => {
    mockGetRecentlyAdded.mockResolvedValue([]);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useRecentlyAdded(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetRecentlyAdded).toHaveBeenCalled();
  });
});

describe("useRecentReleases", () => {
  it("calls getRecentReleases", async () => {
    mockGetRecentReleases.mockResolvedValue([]);

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useRecentReleases(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetRecentReleases).toHaveBeenCalled();
  });
});

describe("useNearbyShows", () => {
  const response = (location: object | null = null) => ({
    configured: true,
    location,
    shows: [],
  });

  // The saved location is one store for the whole app, so each test sets the
  // location it needs rather than relying on the one before.
  async function renderNearby() {
    const { wrapper } = makeWrapper();
    const hook = await renderHook(() => useNearbyShows(), { wrapper });
    await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
    return hook;
  }

  it("asks for shows near the request's address in Your Location mode", async () => {
    mockGetNearbyShows.mockResolvedValue(response());
    const { result } = await renderNearby();

    await act(() => result.current.setMode("ip"));

    await waitFor(() =>
      expect(mockGetNearbyShows).toHaveBeenLastCalledWith({
        zip: "",
        country: "",
      }),
    );
  });

  it("sends the entered ZIP with its country, trimmed and upper-cased", async () => {
    mockGetNearbyShows.mockResolvedValue(response());
    const { result } = await renderNearby();

    await act(() => result.current.setAppliedZip(" 75001 ", "fr"));

    await waitFor(() =>
      expect(mockGetNearbyShows).toHaveBeenLastCalledWith({
        zip: "75001",
        country: "FR",
      }),
    );
  });

  it("asks for nothing while a ZIP is picked but not entered", async () => {
    mockGetNearbyShows.mockResolvedValue(response());
    const { result } = await renderNearby();

    await act(() => result.current.setAppliedZip(""));
    mockGetNearbyShows.mockClear();
    // Pull to refresh lands here too.
    await act(() => result.current.refetch());

    expect(mockGetNearbyShows).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("reports a ZIP the server couldn't place", async () => {
    mockGetNearbyShows.mockResolvedValue(
      response({ resolved: false, label: "00000" }),
    );
    const { result } = await renderNearby();

    await act(() => result.current.setAppliedZip("00000"));

    await waitFor(() =>
      expect(result.current.errorMessage).toBe("ZIP or postal code not found."),
    );
  });
});
