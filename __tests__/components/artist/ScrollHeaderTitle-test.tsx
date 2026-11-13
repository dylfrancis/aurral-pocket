jest.mock("react-native-worklets", () => ({ scheduleOnRN: jest.fn() }));
jest.mock("react-native-reanimated", () => {
  const { ScrollView, Text, View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: {
      ScrollView,
      Text,
      View,
      createAnimatedComponent: (c: unknown) => c,
    },
    Extrapolation: { CLAMP: "clamp" },
    interpolate: jest.fn(),
    useAnimatedReaction: jest.fn(),
    useAnimatedScrollHandler: jest.fn(),
    useAnimatedStyle: jest.fn(),
    useSharedValue: (value: number) => ({ value }),
  };
});
jest.mock("@gorhom/bottom-sheet", () => ({}));

const mockScreenOptions: Record<string, unknown>[] = [];
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  Stack: {
    Screen: ({ options }: { options: Record<string, unknown> }) => {
      mockScreenOptions.push(options);
      return null;
    },
  },
}));

jest.mock("@/constants/navigation", () => ({
  ...jest.requireActual("@/constants/navigation"),
  HAS_LIQUID_GLASS: true,
}));

import { render } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";

import { ScrollHeaderTitle } from "@/components/artist/ArtistDetailLayout";

describe("ScrollHeaderTitle with Liquid Glass", () => {
  // iOS blurs the rows under the bar only while the title is its own text: a
  // custom title view leaves them sharp, and an empty title drops the blur.
  it("sets the name as a native title, clear while the hero is in view", async () => {
    const scrollY = { value: 0 } as SharedValue<number>;

    await render(<ScrollHeaderTitle name="OK Computer" scrollY={scrollY} />);

    expect(mockScreenOptions.at(-1)).toEqual({
      headerTitle: "OK Computer",
      headerTitleStyle: { color: "transparent" },
    });
  });
});
