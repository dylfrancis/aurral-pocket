jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

import { render, fireEvent } from "@testing-library/react-native";
import { NearbyShowRow } from "@/components/discover/NearbyShowRow";
import type { ConcertEvent } from "@/lib/types/search";

const buildShow = (overrides: Partial<ConcertEvent> = {}): ConcertEvent => ({
  id: "show-1",
  artistName: "Radiohead",
  eventName: "Radiohead Live at The Greek",
  date: "2026-07-04",
  time: "8:00 PM",
  dateTime: "2026-07-04T20:00:00Z",
  venueName: "The Greek Theatre",
  city: "Berkeley",
  region: "CA",
  url: "https://example.com",
  matchType: "library",
  distance: 4.2,
  ...overrides,
});

describe("NearbyShowRow", () => {
  it("renders the calendar tile with month, day, and weekday", () => {
    const { getByText } = render(
      <NearbyShowRow show={buildShow()} onPress={jest.fn()} />,
    );

    expect(getByText("JUL")).toBeTruthy();
    expect(getByText("4")).toBeTruthy();
    expect(getByText("SAT")).toBeTruthy();
  });

  it("renders title and falls back to artist as subtitle when distinct", () => {
    const { getByText } = render(
      <NearbyShowRow show={buildShow()} onPress={jest.fn()} />,
    );

    expect(getByText("Radiohead Live at The Greek")).toBeTruthy();
    expect(getByText("Radiohead")).toBeTruthy();
  });

  it("omits the artist subtitle when title and artist match", () => {
    const { queryAllByText } = render(
      <NearbyShowRow
        show={buildShow({ eventName: "Radiohead", artistName: "Radiohead" })}
        onPress={jest.fn()}
      />,
    );

    expect(queryAllByText("Radiohead")).toHaveLength(1);
  });

  it("renders the source badge for library matches", () => {
    const { getByText } = render(
      <NearbyShowRow show={buildShow()} onPress={jest.fn()} />,
    );

    expect(getByText("Library")).toBeTruthy();
  });

  it("renders the recommended badge for recommended matches", () => {
    const { getByText } = render(
      <NearbyShowRow
        show={buildShow({ matchType: "recommended" })}
        onPress={jest.fn()}
      />,
    );

    expect(getByText("Recommended")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <NearbyShowRow show={buildShow()} onPress={onPress} />,
    );

    fireEvent.press(getByText("Radiohead Live at The Greek"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders TBA when the show date cannot be parsed", () => {
    const { getByText } = render(
      <NearbyShowRow
        show={buildShow({ date: null, dateTime: null })}
        onPress={jest.fn()}
      />,
    );

    expect(getByText("TBA")).toBeTruthy();
  });
});
