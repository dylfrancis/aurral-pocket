jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useFocusEffect } from "expo-router";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";

const mockUseFocusEffect = useFocusEffect as jest.Mock;

/** Returns the effect most recently registered with useFocusEffect. */
function latestFocusEffect(): () => void {
  return mockUseFocusEffect.mock.calls.at(-1)![0];
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useRefreshOnFocus", () => {
  it("skips the initial focus", () => {
    const refetch = jest.fn();
    renderHook(() => useRefreshOnFocus(refetch));

    act(() => latestFocusEffect()());

    expect(refetch).not.toHaveBeenCalled();
  });

  it("refetches on every subsequent focus", () => {
    const refetch = jest.fn();
    renderHook(() => useRefreshOnFocus(refetch));

    act(() => latestFocusEffect()()); // initial focus — skipped
    act(() => latestFocusEffect()()); // tab regains focus
    expect(refetch).toHaveBeenCalledTimes(1);

    act(() => latestFocusEffect()());
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("keeps skipping only the first focus across re-renders", () => {
    const refetch = jest.fn();
    const { rerender } = renderHook(() => useRefreshOnFocus(refetch));

    act(() => latestFocusEffect()()); // initial focus — skipped
    rerender({});
    act(() => latestFocusEffect()()); // refocus after re-render

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
