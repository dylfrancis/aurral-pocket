jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { renderHook, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useRecentSearches,
  type RecentSearch,
} from "@/hooks/search/use-recent-searches";

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

const q = (text: string): RecentSearch => ({ type: "query", text });
const artist = (text: string, mbid: string): RecentSearch => ({
  type: "artist",
  text,
  mbid,
});
const tag = (text: string): RecentSearch => ({ type: "tag", text });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockRemoveItem.mockResolvedValue(undefined);
});

describe("useRecentSearches", () => {
  it("starts with empty searches", () => {
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.searches).toEqual([]);
  });

  it("migrates legacy string entries from storage", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(["radiohead", "#rock"]));

    const { result } = renderHook(() => useRecentSearches());
    await act(async () => {});

    expect(result.current.searches).toEqual([q("radiohead"), tag("rock")]);
  });

  it("loads typed entries from storage", async () => {
    const saved = [q("radiohead"), artist("Thom Yorke", "abc-123")];
    mockGetItem.mockResolvedValue(JSON.stringify(saved));

    const { result } = renderHook(() => useRecentSearches());
    await act(async () => {});

    expect(result.current.searches).toEqual(saved);
  });

  it("adds a query to the top", async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => result.current.add(q("radiohead")));
    expect(result.current.searches[0]).toEqual(q("radiohead"));
    expect(mockSetItem).toHaveBeenCalled();
  });

  it("adds an artist to the top", async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => result.current.add(artist("Radiohead", "abc-123")));
    expect(result.current.searches[0]).toEqual(artist("Radiohead", "abc-123"));
  });

  it("deduplicates artists by mbid", async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => result.current.add(artist("Radiohead", "abc-123")));
    await act(async () => result.current.add(q("other")));
    await act(async () => result.current.add(artist("Radiohead", "abc-123")));

    expect(result.current.searches).toHaveLength(2);
    expect(result.current.searches[0]).toEqual(artist("Radiohead", "abc-123"));
  });

  it("deduplicates queries by text", async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => result.current.add(q("first")));
    await act(async () => result.current.add(q("second")));
    await act(async () => result.current.add(q("first")));

    expect(result.current.searches).toEqual([q("first"), q("second")]);
  });

  it("removes a specific entry", async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => result.current.add(q("keep")));
    await act(async () => result.current.add(q("remove")));
    await act(async () => result.current.remove(q("remove")));

    expect(result.current.searches).toEqual([q("keep")]);
  });

  it("clears all searches", async () => {
    const { result } = renderHook(() => useRecentSearches());

    await act(async () => result.current.add(q("one")));
    await act(async () => result.current.add(q("two")));
    await act(async () => result.current.clear());

    expect(result.current.searches).toEqual([]);
    expect(mockRemoveItem).toHaveBeenCalledWith("recent_searches");
  });

  it("limits to 10 entries", async () => {
    const { result } = renderHook(() => useRecentSearches());

    for (let i = 0; i < 15; i++) {
      await act(async () => result.current.add(q(`search-${i}`)));
    }

    expect(result.current.searches).toHaveLength(10);
    expect(result.current.searches[0]).toEqual(q("search-14"));
  });
});
