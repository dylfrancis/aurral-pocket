let mockReducedMotion = false;
// Reanimated's shipped mock fails to load under jest-expo, so this stands in
// for the hooks DiaText calls before it knows whether to animate.
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    useReducedMotion: () => mockReducedMotion,
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: jest.fn(),
    cancelAnimation: jest.fn(),
    Easing: { inOut: jest.fn(), cubic: jest.fn(), bezier: jest.fn() },
  };
});

jest.mock("react-native-worklets", () => ({ scheduleOnRN: jest.fn() }));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import React from "react";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { DiaText } from "@/components/ui/DiaText";
import { Colors } from "@/constants/theme";

const WORDS = ["Discover", "Collect", "Stream"];

beforeEach(() => {
  mockReducedMotion = false;
});

describe("DiaText", () => {
  it("shows the first word still, in the brand green, with reduced motion", async () => {
    mockReducedMotion = true;
    await render(<DiaText words={WORDS} />);

    const word = screen.getByText("Discover");
    expect(StyleSheet.flatten(word.props.style).color).toBe(Colors.dark.brand);
    for (const other of WORDS.slice(1)) {
      expect(
        screen.queryByText(other, { includeHiddenElements: true }),
      ).toBeNull();
    }
  });
});
