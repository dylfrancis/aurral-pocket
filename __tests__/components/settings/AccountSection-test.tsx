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

const saved: ListenHistorySettings = {
  lastfm: "thom",
  listenbrainz: "thom-lb",
  koito: "https://koito.example",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUpdate.mockReturnValue({ mutate, isPending: false });
  mockUseListeningHistory.mockReturnValue({
    data: saved,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });
});

describe("AccountSection", () => {
  it("shows the account saved for each provider", async () => {
    const { getByLabelText } = await render(<AccountSection />);

    expect(getByLabelText("Last.fm username")).toHaveDisplayValue("thom");
    expect(getByLabelText("ListenBrainz username")).toHaveDisplayValue(
      "thom-lb",
    );
    expect(getByLabelText("Koito URL")).toHaveDisplayValue(
      "https://koito.example",
    );
  });

  // An untouched provider stays out of the request, so a value set on the web
  // since the form loaded is not written back.
  it("saves only the providers that changed, clearing an emptied one", async () => {
    const { getByLabelText, getByText } = await render(<AccountSection />);

    await fireEvent.changeText(
      getByLabelText("Last.fm username"),
      " radiohead ",
    );
    await fireEvent.changeText(getByLabelText("ListenBrainz username"), "");
    // Save stays disabled until the edits make the form dirty.
    await waitFor(() => expect(getByText("Save")).toBeEnabled());
    await fireEvent.press(getByText("Save"));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { lastfm: "radiohead", listenbrainz: null },
        expect.anything(),
      ),
    );
  });
});
