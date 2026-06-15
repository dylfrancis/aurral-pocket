import { renderHook, act } from "@testing-library/react-native";
import { useDebouncedValue } from "@/hooks/search/use-debounced-value";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("returns initial value immediately", async () => {
    const { result } = await renderHook(() => useDebouncedValue("hello"));
    expect(result.current).toBe("hello");
  });

  it("does not update before the delay", async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 350),
      { initialProps: { value: "a" } },
    );

    await rerender({ value: "ab" });
    await act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe("a");
  });

  it("updates after the delay", async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 350),
      { initialProps: { value: "a" } },
    );

    await rerender({ value: "ab" });
    await act(() => jest.advanceTimersByTime(350));
    expect(result.current).toBe("ab");
  });

  it("resets the timer on rapid changes", async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 350),
      { initialProps: { value: "a" } },
    );

    await rerender({ value: "ab" });
    await act(() => jest.advanceTimersByTime(200));

    await rerender({ value: "abc" });
    await act(() => jest.advanceTimersByTime(200));

    // Only 200ms since last change — should still be 'a'
    expect(result.current).toBe("a");

    await act(() => jest.advanceTimersByTime(150));
    // Now 350ms since 'abc' was set
    expect(result.current).toBe("abc");
  });

  it("uses custom delay", async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 100),
      { initialProps: { value: "x" } },
    );

    await rerender({ value: "xy" });
    await act(() => jest.advanceTimersByTime(100));
    expect(result.current).toBe("xy");
  });
});
