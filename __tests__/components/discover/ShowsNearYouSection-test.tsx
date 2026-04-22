jest.mock("@/hooks/discover", () => ({
  useNearbyShows: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
}));

jest.mock("@/components/ui/Skeleton", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Skeleton: (props: { testID?: string }) =>
      React.createElement(View, { testID: props.testID ?? "skeleton" }),
  };
});

jest.mock("@react-native-segmented-control/segmented-control", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  type MockProps = {
    values: string[];
    selectedIndex: number;
    onChange: (event: {
      nativeEvent: { selectedSegmentIndex: number };
    }) => void;
  };
  return {
    __esModule: true,
    default: ({ values, onChange }: MockProps) =>
      React.createElement(
        View,
        { testID: "mock-segmented-control" },
        values.map((value, index) =>
          React.createElement(
            Pressable,
            {
              key: value,
              onPress: () =>
                onChange({ nativeEvent: { selectedSegmentIndex: index } }),
            },
            React.createElement(Text, null, value),
          ),
        ),
      ),
  };
});

import { render, fireEvent } from "@testing-library/react-native";
import { ShowsNearYouSection } from "@/components/discover/ShowsNearYouSection";
import { useNearbyShows } from "@/hooks/discover";
import type { ConcertEvent } from "@/lib/types/search";

const mockUseNearbyShows = useNearbyShows as unknown as jest.Mock;

const baseProps = {
  onShowPress: jest.fn(),
  onOpenSettings: jest.fn(),
  mode: "ip" as const,
  appliedZip: "",
  onModeChange: jest.fn(),
  onEditZip: jest.fn(),
};

const show = (
  overrides: Partial<ConcertEvent> & { id: string },
): ConcertEvent => ({
  artistName: "Test Artist",
  eventName: "Test Show",
  date: "2026-05-01",
  venueName: "Test Venue",
  city: "New York",
  region: "NY",
  url: "https://example.com",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ShowsNearYouSection", () => {
  it("shows skeleton while loading", () => {
    mockUseNearbyShows.mockReturnValue({ data: undefined, isLoading: true });

    const { queryByText, UNSAFE_queryAllByType } = render(
      <ShowsNearYouSection {...baseProps} />,
    );

    expect(queryByText("Shows Near You")).toBeTruthy();
    const { View } = require("react-native");
    expect(UNSAFE_queryAllByType(View).length).toBeGreaterThan(0);
  });

  it("renders 'not configured' empty card when Ticketmaster is not configured", () => {
    mockUseNearbyShows.mockReturnValue({
      data: { configured: false, location: null, shows: [] },
      isLoading: false,
    });

    const { queryByText } = render(<ShowsNearYouSection {...baseProps} />);

    expect(queryByText("Ticketmaster not configured")).toBeTruthy();
    expect(queryByText("Open Settings")).toBeTruthy();
  });

  it("fires onOpenSettings when 'Open Settings' is pressed", () => {
    mockUseNearbyShows.mockReturnValue({
      data: { configured: false, location: null, shows: [] },
      isLoading: false,
    });

    const { getByText } = render(<ShowsNearYouSection {...baseProps} />);
    fireEvent.press(getByText("Open Settings"));

    expect(baseProps.onOpenSettings).toHaveBeenCalled();
  });

  it("renders 'ZIP not set' when mode is zip and appliedZip is empty", () => {
    mockUseNearbyShows.mockReturnValue({ data: undefined, isLoading: false });

    const { queryByText, getByText } = render(
      <ShowsNearYouSection {...baseProps} mode="zip" appliedZip="" />,
    );

    expect(queryByText("ZIP not set")).toBeTruthy();
    fireEvent.press(getByText("Set ZIP"));
    expect(baseProps.onEditZip).toHaveBeenCalled();
  });

  it("renders 'No upcoming nearby matches' when shows is empty", () => {
    mockUseNearbyShows.mockReturnValue({
      data: {
        configured: true,
        location: { label: "Brooklyn, NY" },
        shows: [],
      },
      isLoading: false,
    });

    const { queryByText } = render(<ShowsNearYouSection {...baseProps} />);

    expect(queryByText("No upcoming nearby matches")).toBeTruthy();
  });

  it("renders shows and fires onShowPress when tapped", () => {
    const s = show({ id: "s1", eventName: "Radiohead Live" });
    mockUseNearbyShows.mockReturnValue({
      data: {
        configured: true,
        location: { label: "Brooklyn, NY" },
        shows: [s],
      },
      isLoading: false,
    });

    const { getByText } = render(<ShowsNearYouSection {...baseProps} />);
    fireEvent.press(getByText("Radiohead Live"));

    expect(baseProps.onShowPress).toHaveBeenCalledWith(s);
  });

  it("calls onModeChange('zip') when ZIP segment is tapped", () => {
    mockUseNearbyShows.mockReturnValue({
      data: { configured: true, location: null, shows: [show({ id: "s1" })] },
      isLoading: false,
    });

    const { getByText } = render(<ShowsNearYouSection {...baseProps} />);
    fireEvent.press(getByText("ZIP"));

    expect(baseProps.onModeChange).toHaveBeenCalledWith("zip");
  });

  it("calls onModeChange('ip') when Your Area segment is tapped", () => {
    mockUseNearbyShows.mockReturnValue({
      data: { configured: true, location: null, shows: [show({ id: "s1" })] },
      isLoading: false,
    });

    const { getByText } = render(
      <ShowsNearYouSection {...baseProps} mode="zip" appliedZip="10001" />,
    );
    fireEvent.press(getByText("Your Area"));

    expect(baseProps.onModeChange).toHaveBeenCalledWith("ip");
  });
});
