// The loading skeleton animates. Reanimated needs its native side, which Jest
// has none of.
jest.mock("react-native-reanimated", () => {
  const React = require("react");

  const { View } = require("react-native");
  const MockAnimatedView = React.forwardRef(function MockAnimatedView(
    props: any,
    ref: any,
  ) {
    return React.createElement(View, { ...props, ref });
  });
  return {
    __esModule: true,
    default: { View: MockAnimatedView },
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (value: number) => ({ value }),
    withRepeat: jest.fn(),
    withTiming: jest.fn(),
  };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");

  const { TextInput } = require("react-native");
  return {
    BottomSheetTextInput: (props: any) => React.createElement(TextInput, props),
  };
});

// The segmented control is native. A row of buttons stands in for it, so a
// test can pick a provider by its label.
jest.mock("@/components/flow/SegmentedRow", () => {
  const React = require("react");

  const { Pressable, Text } = require("react-native");
  return {
    SegmentedRow: ({ options, onChange }: any) =>
      React.createElement(
        React.Fragment,
        null,
        options.map((option: any) =>
          React.createElement(
            Pressable,
            { key: option.value, onPress: () => onChange(option.value) },
            React.createElement(Text, null, option.label),
          ),
        ),
      ),
  };
});

jest.mock("@/hooks/me/use-listening-history", () => ({
  useListeningHistory: jest.fn(),
  useUpdateListeningHistory: jest.fn(),
}));

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccountSection } from "@/components/settings/sections/AccountSection";
import {
  useListeningHistory,
  useUpdateListeningHistory,
} from "@/hooks/me/use-listening-history";
import type { ListenHistorySettings } from "@/lib/types/me";

const mockUseListeningHistory = useListeningHistory as jest.Mock;
const mockUseUpdate = useUpdateListeningHistory as jest.Mock;
const mutate = jest.fn();

function settings(
  overrides: Partial<ListenHistorySettings> = {},
): ListenHistorySettings {
  return {
    listenHistoryProvider: "lastfm",
    listenHistoryUsername: "thom",
    lastfmUsername: "thom",
    listenHistoryUrl: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUpdate.mockReturnValue({ mutate, isPending: false });
  mockUseListeningHistory.mockReturnValue({
    data: settings(),
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });
});

describe("AccountSection", () => {
  it("offers the local provider Aurral 2.5 added", async () => {
    const { getByText } = await render(<AccountSection />);

    expect(getByText("Local only")).toBeTruthy();
  });

  // The server keeps no username for "local" and answers with null.
  it("hides the username field for local history", async () => {
    const { getByText, queryByText } = await render(<AccountSection />);
    expect(getByText("Username")).toBeTruthy();

    fireEvent.press(getByText("Local only"));

    await waitFor(() => expect(queryByText("Username")).toBeNull());
  });

  it("saves local history without a username", async () => {
    const { getByText, queryByText } = await render(<AccountSection />);

    fireEvent.press(getByText("Local only"));
    // The form re-renders before Save comes alive: it stays disabled until the
    // provider change makes the form dirty.
    await waitFor(() => expect(queryByText("Username")).toBeNull());
    fireEvent.press(getByText("Save"));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          listenHistoryProvider: "local",
          listenHistoryUsername: null,
        },
        expect.anything(),
      ),
    );
  });

  it("shows the username a linked account already has", async () => {
    mockUseListeningHistory.mockReturnValue({
      data: settings({
        listenHistoryProvider: "listenbrainz",
        listenHistoryUsername: "thom",
      }),
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { getByDisplayValue } = await render(<AccountSection />);

    expect(getByDisplayValue("thom")).toBeTruthy();
  });
});
