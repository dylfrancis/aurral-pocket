import { act, renderHook } from "@testing-library/react-native";
import * as Burnt from "burnt";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

const mockToast = Burnt.toast as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockToast.mockClear();
});

describe("usePullToRefresh", () => {
  it("shows the spinner only while the refresh runs", async () => {
    const pending = deferred<{ isError: boolean }>();
    const { result } = await renderHook(() =>
      usePullToRefresh(() => pending.promise),
    );

    let refresh!: Promise<void>;
    await act(async () => {
      refresh = result.current.onRefresh();
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      pending.resolve({ isError: false });
      await refresh;
    });
    expect(result.current.refreshing).toBe(false);
  });

  it.each([
    ["a query result in error", { isError: true }],
    ["false", false],
  ])(
    "toasts the error title when the refresh resolves to %s",
    async (_, outcome) => {
      const { result } = await renderHook(() =>
        usePullToRefresh(async () => outcome, "Couldn't refresh genres"),
      );

      await act(() => result.current.onRefresh());

      expect(mockToast).toHaveBeenCalledWith({
        title: "Couldn't refresh genres",
        preset: "error",
      });
    },
  );

  it("stays quiet when the refresh succeeds", async () => {
    const { result } = await renderHook(() =>
      usePullToRefresh(async () => ({ isError: false }), "Couldn't refresh"),
    );

    await act(() => result.current.onRefresh());

    expect(mockToast).not.toHaveBeenCalled();
  });

  it("treats a refresh that throws as failed", async () => {
    const { result } = await renderHook(() =>
      usePullToRefresh(
        () => Promise.reject(new Error("offline")),
        "Couldn't refresh",
      ),
    );

    await act(() => result.current.onRefresh());

    expect(result.current.refreshing).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: "Couldn't refresh",
      preset: "error",
    });
  });
});
