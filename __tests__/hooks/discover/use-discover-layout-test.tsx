jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock("@/lib/api/me", () => ({
  getMyDiscoverLayout: jest.fn(),
  updateMyDiscoverLayout: jest.fn(),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(() => ({
    user: { id: 42, username: "test", role: "user", permissions: {} },
  })),
}));

import { renderHook, act, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/auth-context";
import { getMyDiscoverLayout, updateMyDiscoverLayout } from "@/lib/api/me";
import {
  DEFAULT_DISCOVER_SECTIONS,
  normalizeDiscoverLayout,
  useDiscoverLayout,
} from "@/hooks/discover/use-discover-layout";

const mockStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};
const mockGetLayout = getMyDiscoverLayout as jest.Mock;
const mockUpdateLayout = updateMyDiscoverLayout as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 42, username: "test", role: "user", permissions: {} },
  });
  mockStorage.getItem.mockResolvedValue(null);
  mockStorage.setItem.mockResolvedValue(undefined);
  mockStorage.removeItem.mockResolvedValue(undefined);
  mockGetLayout.mockImplementation(() => new Promise(() => {}));
});

describe("normalizeDiscoverLayout", () => {
  it("returns null for non-arrays", () => {
    expect(normalizeDiscoverLayout(null)).toBeNull();
    expect(normalizeDiscoverLayout("nope")).toBeNull();
    expect(normalizeDiscoverLayout({ id: "recommended" })).toBeNull();
  });

  it("preserves order and enabled flags for known sections", () => {
    const input = [
      { id: "globalTop", enabled: false },
      { id: "recommended", enabled: true },
    ];
    const result = normalizeDiscoverLayout(input);
    expect(result?.[0]).toMatchObject({ id: "globalTop", enabled: false });
    expect(result?.[1]).toMatchObject({ id: "recommended", enabled: true });
  });

  it("drops unknown ids and appends missing defaults at the end", () => {
    const input = [
      { id: "unknown", enabled: true },
      { id: "playlists", enabled: false },
    ];
    const result = normalizeDiscoverLayout(input);
    expect(result?.[0]).toMatchObject({ id: "playlists", enabled: false });
    expect(result?.map((s) => s.id)).toEqual(
      expect.arrayContaining(DEFAULT_DISCOVER_SECTIONS.map((s) => s.id)),
    );
    expect(result).toHaveLength(DEFAULT_DISCOVER_SECTIONS.length);
  });
});

describe("useDiscoverLayout", () => {
  it("starts with hydrated=false and defaults", async () => {
    mockStorage.getItem.mockImplementation(() => new Promise(() => {}));

    const { result } = await renderHook(() => useDiscoverLayout());

    expect(result.current.hydrated).toBe(false);
    expect(result.current.sections.map((s) => s.id)).toEqual(
      DEFAULT_DISCOVER_SECTIONS.map((s) => s.id),
    );
  });

  it("uses defaults when AsyncStorage is empty", async () => {
    mockStorage.getItem.mockResolvedValue(null);

    const { result } = await renderHook(() => useDiscoverLayout());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.sections).toHaveLength(
      DEFAULT_DISCOVER_SECTIONS.length,
    );
  });

  it("hydrates from AsyncStorage when present", async () => {
    const stored = [
      { id: "globalTop", enabled: false },
      { id: "recommended", enabled: true },
    ];
    mockStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const { result } = await renderHook(() => useDiscoverLayout());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.sections[0].id).toBe("globalTop");
    expect(result.current.sections[0].enabled).toBe(false);
  });

  it("scopes the storage key per user", async () => {
    await renderHook(() => useDiscoverLayout());

    await waitFor(() =>
      expect(mockStorage.getItem).toHaveBeenCalledWith("discoverLayout:42"),
    );
  });

  it("falls back to defaults and stays hydrated when AsyncStorage rejects", async () => {
    mockStorage.getItem.mockRejectedValue(new Error("disk error"));

    const { result } = await renderHook(() => useDiscoverLayout());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.sections).toHaveLength(
      DEFAULT_DISCOVER_SECTIONS.length,
    );
  });

  it("server response overrides local after hydration", async () => {
    mockStorage.getItem.mockResolvedValue(null);
    mockGetLayout.mockResolvedValue({
      layout: [{ id: "playlists", enabled: false }],
    });

    const { result } = await renderHook(() => useDiscoverLayout());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await waitFor(() =>
      expect(result.current.sections[0].id).toBe("playlists"),
    );
    expect(result.current.sections[0].enabled).toBe(false);
    await waitFor(() =>
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        "discoverLayout:42",
        expect.any(String),
      ),
    );
  });

  it("keeps local layout when server fetch fails", async () => {
    mockStorage.getItem.mockResolvedValue(
      JSON.stringify([{ id: "globalTop", enabled: false }]),
    );
    mockGetLayout.mockRejectedValue(new Error("network down"));

    const { result } = await renderHook(() => useDiscoverLayout());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.sections[0].id).toBe("globalTop");
    expect(result.current.sections[0].enabled).toBe(false);
  });

  it("does not call the server when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockStorage.getItem.mockResolvedValue(null);

    const { result } = await renderHook(() => useDiscoverLayout());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(mockGetLayout).not.toHaveBeenCalled();
  });

  it("saveLayout writes optimistically and persists server-normalized result", async () => {
    mockStorage.getItem.mockResolvedValue(null);
    mockGetLayout.mockImplementation(() => new Promise(() => {}));
    mockUpdateLayout.mockResolvedValue({
      layout: [{ id: "recommended", enabled: true }],
    });

    const { result } = await renderHook(() => useDiscoverLayout());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    const next = DEFAULT_DISCOVER_SECTIONS.map((s) => ({
      ...s,
      enabled: s.id === "recommended",
    }));

    await act(async () => {
      await result.current.saveLayout(next);
    });

    expect(mockUpdateLayout).toHaveBeenCalledWith(next);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      "discoverLayout:42",
      expect.any(String),
    );
    expect(result.current.sections[0].id).toBe("recommended");
  });

  it("saveLayout reverts AsyncStorage and state when the server PATCH fails", async () => {
    const initial = [{ id: "globalTop", enabled: false }];
    mockStorage.getItem.mockResolvedValue(JSON.stringify(initial));
    mockGetLayout.mockImplementation(() => new Promise(() => {}));
    mockUpdateLayout.mockRejectedValue(new Error("server error"));

    const { result } = await renderHook(() => useDiscoverLayout());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    const previousId = result.current.sections[0].id;

    const next = DEFAULT_DISCOVER_SECTIONS.map((s) => ({
      ...s,
      enabled: false,
    }));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.saveLayout(next);
      } catch (err) {
        caught = err;
      }
    });

    expect((caught as Error)?.message).toBe("server error");
    expect(result.current.sections[0].id).toBe(previousId);
    expect(mockStorage.setItem).toHaveBeenLastCalledWith(
      "discoverLayout:42",
      JSON.stringify(initial),
    );
  });

  it("saveLayout removes the storage entry on server failure if none existed before", async () => {
    mockStorage.getItem.mockResolvedValue(null);
    mockGetLayout.mockImplementation(() => new Promise(() => {}));
    mockUpdateLayout.mockRejectedValue(new Error("offline"));

    const { result } = await renderHook(() => useDiscoverLayout());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.saveLayout(
          DEFAULT_DISCOVER_SECTIONS.map((s) => ({ ...s, enabled: false })),
        );
      } catch (err) {
        caught = err;
      }
    });

    expect((caught as Error)?.message).toBe("offline");
    expect(mockStorage.removeItem).toHaveBeenCalledWith("discoverLayout:42");
  });
});
