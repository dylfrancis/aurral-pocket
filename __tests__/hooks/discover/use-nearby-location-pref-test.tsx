jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { renderHook, act, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNearbyLocationPref } from "@/hooks/discover/use-nearby-location-pref";

const mockStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useNearbyLocationPref", () => {
  it("starts with defaults before hydration resolves", () => {
    mockStorage.getItem.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useNearbyLocationPref());

    expect(result.current.mode).toBe("ip");
    expect(result.current.appliedZip).toBe("");
    expect(result.current.hydrated).toBe(false);
  });

  it("flips hydrated to true after AsyncStorage resolves", async () => {
    mockStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook(() => useNearbyLocationPref());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.mode).toBe("ip");
    expect(result.current.appliedZip).toBe("");
  });

  it("restores stored 'zip' mode and zip on mount", async () => {
    mockStorage.getItem.mockImplementation((key: string) => {
      if (key === "discoverNearbyMode") return Promise.resolve("zip");
      if (key === "discoverNearbyZip") return Promise.resolve("10001");
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useNearbyLocationPref());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.mode).toBe("zip");
    expect(result.current.appliedZip).toBe("10001");
  });

  it("ignores invalid stored mode values", async () => {
    mockStorage.getItem.mockImplementation((key: string) => {
      if (key === "discoverNearbyMode") return Promise.resolve("garbage");
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useNearbyLocationPref());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.mode).toBe("ip");
  });

  it("swallows AsyncStorage rejections and still flips hydrated", async () => {
    mockStorage.getItem.mockRejectedValue(new Error("storage unavailable"));

    const { result } = renderHook(() => useNearbyLocationPref());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.mode).toBe("ip");
    expect(result.current.appliedZip).toBe("");
  });

  it("persists mode changes to AsyncStorage", async () => {
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.setItem.mockResolvedValue(undefined);

    const { result } = renderHook(() => useNearbyLocationPref());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.setMode("zip");
    });

    expect(result.current.mode).toBe("zip");
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      "discoverNearbyMode",
      "zip",
    );
  });

  it("persists zip changes to AsyncStorage", async () => {
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.setItem.mockResolvedValue(undefined);

    const { result } = renderHook(() => useNearbyLocationPref());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.setAppliedZip("94110");
    });

    expect(result.current.appliedZip).toBe("94110");
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      "discoverNearbyZip",
      "94110",
    );
  });

  it("swallows setItem rejections without throwing", async () => {
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.setItem.mockRejectedValue(new Error("disk full"));

    const { result } = renderHook(() => useNearbyLocationPref());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(() => {
      act(() => {
        result.current.setAppliedZip("12345");
      });
    }).not.toThrow();
    expect(result.current.appliedZip).toBe("12345");
  });
});
