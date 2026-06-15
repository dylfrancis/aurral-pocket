jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: { source?: { uri?: string }; testID?: string }) =>
      React.createElement(View, {
        testID: props.testID ?? "show-image",
        accessibilityLabel: props.source?.uri,
      }),
  };
});

import { render, fireEvent } from "@testing-library/react-native";
import { NearbyShowRow } from "@/components/discover/NearbyShowRow";
import type { ConcertEvent } from "@/lib/types/search";

const buildShow = (overrides: Partial<ConcertEvent> = {}): ConcertEvent => ({
  id: "show-1",
  artistName: "The Strokes",
  eventName: "The Strokes – Reality Awaits North America",
  date: "2026-07-14",
  time: "19:00:00",
  dateTime: "2026-07-14T19:00:00",
  venueName: "Riverbend Music Center",
  city: "Cincinnati",
  region: "OH",
  url: "https://example.com",
  matchType: "library",
  distance: 7,
  image: "https://example.com/promo.jpg",
  ...overrides,
});

describe("NearbyShowRow", () => {
  it("renders the event image when provided", async () => {
    const { getByTestId } = await render(
      <NearbyShowRow show={buildShow()} onPress={jest.fn()} />,
    );
    expect(getByTestId("show-image")).toBeTruthy();
  });

  it("renders distance pill in MI when distance is finite", async () => {
    const { getByText } = await render(
      <NearbyShowRow show={buildShow()} onPress={jest.fn()} />,
    );
    expect(getByText("7 MI")).toBeTruthy();
  });

  it("omits the distance pill when distance is not finite", async () => {
    const { queryByText } = await render(
      <NearbyShowRow
        show={buildShow({ distance: undefined })}
        onPress={jest.fn()}
      />,
    );
    expect(queryByText(/MI$/)).toBeFalsy();
  });

  it("renders the event title and the artist subtitle when they differ", async () => {
    const { getByText } = await render(
      <NearbyShowRow show={buildShow()} onPress={jest.fn()} />,
    );
    expect(
      getByText("The Strokes – Reality Awaits North America"),
    ).toBeTruthy();
    expect(getByText("The Strokes")).toBeTruthy();
  });

  it("omits the artist subtitle when title and artist match", async () => {
    const { queryAllByText } = await render(
      <NearbyShowRow
        show={buildShow({
          eventName: "The Strokes",
          artistName: "The Strokes",
        })}
        onPress={jest.fn()}
      />,
    );
    expect(queryAllByText("The Strokes")).toHaveLength(1);
  });

  it("formats the date label as 'MMM d, yyyy at HH:mm:ss'", async () => {
    const { getByText } = await render(
      <NearbyShowRow show={buildShow()} onPress={jest.fn()} />,
    );
    expect(getByText("Jul 14, 2026 at 19:00:00")).toBeTruthy();
  });

  it("renders the venue and city/region as the location line", async () => {
    const { getByText } = await render(
      <NearbyShowRow show={buildShow()} onPress={jest.fn()} />,
    );
    expect(getByText("Riverbend Music Center – Cincinnati, OH")).toBeTruthy();
  });

  it("renders the source badge for library matches", async () => {
    const { getByText } = await render(
      <NearbyShowRow show={buildShow()} onPress={jest.fn()} />,
    );
    expect(getByText("Library")).toBeTruthy();
  });

  it("renders the recommended badge for recommended matches", async () => {
    const { getByText } = await render(
      <NearbyShowRow
        show={buildShow({ matchType: "recommended" })}
        onPress={jest.fn()}
      />,
    );
    expect(getByText("Recommended")).toBeTruthy();
  });

  it("calls onPress when tapped", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <NearbyShowRow show={buildShow()} onPress={onPress} />,
    );
    await fireEvent.press(
      getByText("The Strokes – Reality Awaits North America"),
    );
    expect(onPress).toHaveBeenCalled();
  });
});
