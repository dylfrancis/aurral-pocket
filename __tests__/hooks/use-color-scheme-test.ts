import { renderHook } from "@testing-library/react-native";
import { useColorScheme as useRNColorScheme } from "react-native";

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  actual.useColorScheme = jest.fn();
  return actual;
});

import { useColorScheme } from "@/hooks/use-color-scheme";

const mockRNColorScheme = useRNColorScheme as jest.Mock;

describe("useColorScheme", () => {
  it('returns "dark" when system is dark', async () => {
    mockRNColorScheme.mockReturnValue("dark");
    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe("dark");
  });

  it('returns "light" when system is light', async () => {
    mockRNColorScheme.mockReturnValue("light");
    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe("light");
  });

  it('returns "light" when system returns null', async () => {
    mockRNColorScheme.mockReturnValue(null);
    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe("light");
  });

  it('returns "light" when system returns undefined', async () => {
    mockRNColorScheme.mockReturnValue(undefined);
    const { result } = await renderHook(() => useColorScheme());
    expect(result.current).toBe("light");
  });
});
