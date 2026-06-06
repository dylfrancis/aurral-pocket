jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import React, { useCallback } from "react";
import { Appearance, Pressable, Text } from "react-native";
import { render, waitFor, fireEvent, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useThemePreference } from "@/contexts/theme-context";
import type { ThemePreference } from "@/lib/types/theme";

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const setColorSchemeSpy = jest.spyOn(Appearance, "setColorScheme");

beforeEach(() => {
  jest.clearAllMocks();
  setColorSchemeSpy.mockImplementation(() => {});
});

function TestConsumer() {
  const { preference, isThemeLoaded, setPreference } = useThemePreference();
  const choose = useCallback(
    (next: ThemePreference) => () => {
      void setPreference(next);
    },
    [setPreference],
  );
  return (
    <>
      <Text testID="preference">{preference}</Text>
      <Text testID="loaded">{isThemeLoaded ? "yes" : "no"}</Text>
      <Pressable testID="set-dark" onPress={choose("dark")} />
      <Pressable testID="set-system" onPress={choose("system")} />
    </>
  );
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <TestConsumer />
    </ThemeProvider>,
  );
}

describe("ThemeProvider hydration", () => {
  it("applies a stored 'dark' preference on mount", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("dark");
    const { getByTestId } = renderProvider();

    await waitFor(() =>
      expect(getByTestId("loaded").props.children).toBe("yes"),
    );
    expect(getByTestId("preference").props.children).toBe("dark");
    expect(setColorSchemeSpy).toHaveBeenCalledWith("dark");
  });

  it("applies a stored 'light' preference on mount", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("light");
    const { getByTestId } = renderProvider();

    await waitFor(() =>
      expect(getByTestId("loaded").props.children).toBe("yes"),
    );
    expect(setColorSchemeSpy).toHaveBeenCalledWith("light");
  });

  it("defaults to 'system' and hands control to the OS when nothing stored", async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const { getByTestId } = renderProvider();

    await waitFor(() =>
      expect(getByTestId("loaded").props.children).toBe("yes"),
    );
    expect(getByTestId("preference").props.children).toBe("system");
    expect(setColorSchemeSpy).toHaveBeenCalledWith("unspecified");
  });

  it("falls back to 'system' for a garbage stored value", async () => {
    // AppStorage.getThemePreference validates and returns null for unknown values
    mockAsyncStorage.getItem.mockResolvedValue("neon");
    const { getByTestId } = renderProvider();

    await waitFor(() =>
      expect(getByTestId("loaded").props.children).toBe("yes"),
    );
    expect(getByTestId("preference").props.children).toBe("system");
    expect(setColorSchemeSpy).toHaveBeenCalledWith("unspecified");
  });
});

describe("ThemeProvider.setPreference", () => {
  it("applies and persists a new preference", async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const { getByTestId } = renderProvider();
    await waitFor(() =>
      expect(getByTestId("loaded").props.children).toBe("yes"),
    );

    await act(async () => {
      fireEvent.press(getByTestId("set-dark"));
    });

    expect(getByTestId("preference").props.children).toBe("dark");
    expect(setColorSchemeSpy).toHaveBeenCalledWith("dark");
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "theme_preference",
      "dark",
    );
  });

  it("hands control back to the OS when switching to system", async () => {
    mockAsyncStorage.getItem.mockResolvedValue("dark");
    const { getByTestId } = renderProvider();
    await waitFor(() =>
      expect(getByTestId("loaded").props.children).toBe("yes"),
    );

    await act(async () => {
      fireEvent.press(getByTestId("set-system"));
    });

    expect(getByTestId("preference").props.children).toBe("system");
    expect(setColorSchemeSpy).toHaveBeenLastCalledWith("unspecified");
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "theme_preference",
      "system",
    );
  });
});
