jest.mock("@/hooks/discover", () => ({
  useNearbyShows: jest.fn(),
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: jest.fn(),
}));

// A bottom sheet, which needs Reanimated's native side.
jest.mock("@/components/discover/NearbyZipEditorSheet", () => ({
  NearbyZipEditorSheet: () => null,
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
    Skeleton: () => React.createElement(View),
  };
});

import { render, fireEvent } from "@testing-library/react-native";
import { ShowsNearYouSection } from "@/components/discover/ShowsNearYouSection";
import { useNearbyShows } from "@/hooks/discover";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import type { ConcertEvent } from "@/lib/types/search";

const mockUseNearbyShows = useNearbyShows as unknown as jest.Mock;
const mockUseHasPermission = useHasPermission as unknown as jest.Mock;

const baseProps = {
  onShowPress: jest.fn(),
  onViewAll: jest.fn(),
};

const show = (
  overrides: Partial<ConcertEvent> & { id: string },
): ConcertEvent => ({
  artistNames: ["Test Artist"],
  sourceTypes: ["library"],
  eventName: "Test Show",
  date: "2026-12-05",
  time: "19:00:00",
  venueName: "Test Venue",
  city: "Cincinnati",
  region: "OH",
  url: "https://example.com",
  ...overrides,
});

function nearby(overrides: Record<string, unknown> = {}) {
  mockUseNearbyShows.mockReturnValue({
    data: undefined,
    isLoading: false,
    errorMessage: null,
    mode: "ip",
    appliedZip: "",
    appliedCountry: "",
    hydrated: true,
    setMode: jest.fn(),
    setAppliedZip: jest.fn(),
    locationLabel: "Cincinnati, OH, US",
    ...overrides,
  });
}

const located = (shows: ConcertEvent[]) => ({
  configured: true,
  location: { resolved: true, city: "Cincinnati", label: "Cincinnati, OH, US" },
  shows,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseHasPermission.mockReturnValue(() => false);
});

describe("ShowsNearYouSection", () => {
  it("shows loading rows in the rail's style", async () => {
    nearby({ isLoading: true });

    const { getByTestId } = await render(
      <ShowsNearYouSection {...baseProps} />,
    );

    expect(getByTestId("shows-near-you-skeleton")).toBeTruthy();
  });

  it.each([
    [
      true,
      "Add a Ticketmaster key in Aurral's web Settings → Discovery to find nearby shows.",
    ],
    [false, "An admin needs to add a Ticketmaster key to find nearby shows."],
  ])(
    "explains a missing Ticketmaster key (can manage the server: %s)",
    async (canManage, message) => {
      mockUseHasPermission.mockReturnValue(
        (permission: string) => canManage && permission === "accessSettings",
      );
      nearby({ data: { configured: false, location: null, shows: [] } });

      const { getByText, queryByLabelText } = await render(
        <ShowsNearYouSection {...baseProps} />,
      );

      expect(getByText("Ticketmaster not configured")).toBeTruthy();
      expect(getByText(message)).toBeTruthy();
      expect(queryByLabelText(/^Location,/)).toBeNull();
    },
  );

  it("says why the shows couldn't load, with the location menu to fix it", async () => {
    nearby({
      mode: "zip",
      appliedZip: "00000",
      data: { configured: true, location: { resolved: false }, shows: [] },
      errorMessage: "ZIP or postal code not found.",
    });

    const { getByText, getByLabelText } = await render(
      <ShowsNearYouSection {...baseProps} />,
    );

    expect(getByText("Could not load nearby shows.")).toBeTruthy();
    expect(getByText("ZIP or postal code not found.")).toBeTruthy();
    expect(getByLabelText("Location, Location")).toBeTruthy();
  });

  it("asks for a location when ZIP is picked but not entered", async () => {
    nearby({ mode: "zip", appliedZip: "" });

    const { getByText } = await render(<ShowsNearYouSection {...baseProps} />);

    expect(getByText("Location not set")).toBeTruthy();
  });

  it("says when nothing nearby matched", async () => {
    nearby({ data: located([]) });

    const { getByText } = await render(<ShowsNearYouSection {...baseProps} />);

    expect(
      getByText("No matching shows near Cincinnati, OH, US."),
    ).toBeTruthy();
  });

  it.each([
    ["list", 4],
    ["square", 6],
    ["wide", 6],
  ] as const)("draws the %s style with %i shows", async (feedStyle, count) => {
    nearby({
      data: located(
        Array.from({ length: 6 }, (_, i) =>
          show({ id: `s${i}`, artistNames: [`Artist ${i}`] }),
        ),
      ),
    });

    const { getAllByText } = await render(
      <ShowsNearYouSection {...baseProps} feedStyle={feedStyle} />,
    );

    expect(getAllByText(/^Artist \d$/)).toHaveLength(count);
  });

  it("opens a show's tickets", async () => {
    const s = show({ id: "s1", eventName: "Radiohead Live" });
    nearby({ data: located([s]) });

    const { getByLabelText } = await render(
      <ShowsNearYouSection {...baseProps} />,
    );
    await fireEvent.press(getByLabelText("Open tickets for Radiohead Live"));

    expect(baseProps.onShowPress).toHaveBeenCalledWith(s);
  });

  it("opens the Shows page from the header", async () => {
    nearby({ data: located([show({ id: "s1" })]) });

    const { getByText } = await render(<ShowsNearYouSection {...baseProps} />);
    await fireEvent.press(getByText("Shows Near You"));

    expect(baseProps.onViewAll).toHaveBeenCalled();
  });
});
