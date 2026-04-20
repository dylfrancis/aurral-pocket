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
import { renderHook, waitFor } from "@testing-library/react-native";
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

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
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

describe("useDiscovery", () => {
  it("calls getDiscovery and returns the response", async () => {
    const data = {
      recommendations: [],
      globalTop: [],
      basedOn: [],
      topTags: [],
      topGenres: [],
      lastUpdated: null,
      isUpdating: false,
      configured: true,
    };
    mockGetDiscovery.mockResolvedValue(data);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDiscovery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(mockGetDiscovery).toHaveBeenCalledTimes(1);
  });
});

describe("useRecentlyAdded", () => {
  it("calls getRecentlyAdded", async () => {
    mockGetRecentlyAdded.mockResolvedValue([]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRecentlyAdded(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetRecentlyAdded).toHaveBeenCalled();
  });
});

describe("useRecentReleases", () => {
  it("calls getRecentReleases", async () => {
    mockGetRecentReleases.mockResolvedValue([]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRecentReleases(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetRecentReleases).toHaveBeenCalled();
  });
});

describe("useNearbyShows", () => {
  const emptyResponse = {
    configured: true,
    location: null,
    shows: [],
  };

  it("calls getNearbyShows with undefined args by default", async () => {
    mockGetNearbyShows.mockResolvedValue(emptyResponse);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useNearbyShows(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetNearbyShows).toHaveBeenCalledWith(undefined, undefined);
  });

  it("forwards zipCode and limit to the API", async () => {
    mockGetNearbyShows.mockResolvedValue(emptyResponse);

    const { wrapper } = makeWrapper();
    renderHook(() => useNearbyShows({ zipCode: "10001", limit: 5 }), {
      wrapper,
    });

    await waitFor(() =>
      expect(mockGetNearbyShows).toHaveBeenCalledWith("10001", 5),
    );
  });

  it("respects enabled: false", () => {
    mockGetNearbyShows.mockResolvedValue(emptyResponse);

    const { wrapper } = makeWrapper();
    renderHook(() => useNearbyShows({ enabled: false }), { wrapper });

    expect(mockGetNearbyShows).not.toHaveBeenCalled();
  });

  it("uses distinct query keys for different zip/limit pairs", async () => {
    mockGetNearbyShows.mockResolvedValue(emptyResponse);
    const { wrapper, client } = makeWrapper();

    renderHook(() => useNearbyShows({ zipCode: "10001", limit: 10 }), {
      wrapper,
    });
    renderHook(() => useNearbyShows({ zipCode: "10001", limit: 20 }), {
      wrapper,
    });

    await waitFor(() => expect(mockGetNearbyShows.mock.calls.length).toBe(2));

    const keys = client
      .getQueryCache()
      .findAll()
      .map((q) => q.queryKey);
    expect(keys).toHaveLength(2);
  });
});
