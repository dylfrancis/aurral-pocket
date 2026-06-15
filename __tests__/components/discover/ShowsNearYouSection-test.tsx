jest.mock("@/hooks/discover", () => ({
  useNearbyShows: jest.fn(),
  useNearbyLocationPref: jest.fn(),
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

import { render, fireEvent } from "@testing-library/react-native";
import { ShowsNearYouSection } from "@/components/discover/ShowsNearYouSection";
import { useNearbyLocationPref, useNearbyShows } from "@/hooks/discover";
import type { ConcertEvent } from "@/lib/types/search";

const mockUseNearbyShows = useNearbyShows as unknown as jest.Mock;
const mockUseNearbyLocationPref = useNearbyLocationPref as unknown as jest.Mock;

const baseProps = {
  onShowPress: jest.fn(),
  onOpenSettings: jest.fn(),
  onViewAll: jest.fn(),
};

const defaultPref = {
  mode: "ip" as const,
  appliedZip: "",
  hydrated: true,
  setMode: jest.fn(),
  setAppliedZip: jest.fn(),
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
  mockUseNearbyLocationPref.mockReturnValue(defaultPref);
});

describe("ShowsNearYouSection", () => {
  it("shows skeleton while loading", async () => {
    mockUseNearbyShows.mockReturnValue({ data: undefined, isLoading: true });

    const { queryByText, getByTestId } = await render(
      <ShowsNearYouSection {...baseProps} />,
    );

    expect(queryByText("Shows Near You")).toBeTruthy();
    expect(getByTestId("shows-near-you-skeleton")).toBeTruthy();
  });

  it("renders 'not configured' empty card when Ticketmaster is not configured", async () => {
    mockUseNearbyShows.mockReturnValue({
      data: { configured: false, location: null, shows: [] },
      isLoading: false,
    });

    const { queryByText } = await render(
      <ShowsNearYouSection {...baseProps} />,
    );

    expect(queryByText("Ticketmaster not configured")).toBeTruthy();
    expect(queryByText("Open Settings")).toBeTruthy();
  });

  it("fires onOpenSettings when 'Open Settings' is pressed", async () => {
    mockUseNearbyShows.mockReturnValue({
      data: { configured: false, location: null, shows: [] },
      isLoading: false,
    });

    const { getByText } = await render(<ShowsNearYouSection {...baseProps} />);
    await fireEvent.press(getByText("Open Settings"));

    expect(baseProps.onOpenSettings).toHaveBeenCalled();
  });

  it("renders 'ZIP not set' when mode is zip and appliedZip is empty, routes to full page", async () => {
    mockUseNearbyLocationPref.mockReturnValue({
      ...defaultPref,
      mode: "zip",
      appliedZip: "",
    });
    mockUseNearbyShows.mockReturnValue({ data: undefined, isLoading: false });

    const { queryByText, getByText } = await render(
      <ShowsNearYouSection {...baseProps} />,
    );

    expect(queryByText("ZIP not set")).toBeTruthy();
    await fireEvent.press(getByText("Open Shows Near You"));
    expect(baseProps.onViewAll).toHaveBeenCalled();
  });

  it("renders 'No upcoming nearby matches' when shows is empty", async () => {
    mockUseNearbyShows.mockReturnValue({
      data: {
        configured: true,
        location: { label: "Brooklyn, NY" },
        shows: [],
      },
      isLoading: false,
    });

    const { queryByText } = await render(
      <ShowsNearYouSection {...baseProps} />,
    );

    expect(queryByText("No upcoming nearby matches")).toBeTruthy();
  });

  it("renders shows and fires onShowPress when tapped", async () => {
    const s = show({ id: "s1", eventName: "Radiohead Live" });
    mockUseNearbyShows.mockReturnValue({
      data: {
        configured: true,
        location: { label: "Brooklyn, NY" },
        shows: [s],
      },
      isLoading: false,
    });

    const { getByText } = await render(<ShowsNearYouSection {...baseProps} />);
    await fireEvent.press(getByText("Radiohead Live"));

    expect(baseProps.onShowPress).toHaveBeenCalledWith(s);
  });

  it("invokes onViewAll when the header chevron is pressed", async () => {
    mockUseNearbyShows.mockReturnValue({
      data: { configured: true, location: null, shows: [show({ id: "s1" })] },
      isLoading: false,
    });

    const { getByText } = await render(<ShowsNearYouSection {...baseProps} />);
    await fireEvent.press(getByText("Shows Near You"));

    expect(baseProps.onViewAll).toHaveBeenCalled();
  });
});
