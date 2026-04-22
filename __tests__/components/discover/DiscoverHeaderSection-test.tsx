jest.mock("@/hooks/discover", () => ({
  useDiscovery: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("@/components/ui/Skeleton", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Skeleton: () => React.createElement(View, { testID: "skeleton" }),
  };
});

import { render, fireEvent } from "@testing-library/react-native";
import { DiscoverHeaderSection } from "@/components/discover/DiscoverHeaderSection";
import { useDiscovery } from "@/hooks/discover";

const mockHook = useDiscovery as jest.Mock;

const baseData = {
  recommendations: [],
  globalTop: [],
  basedOn: [],
  topTags: [],
  topGenres: [],
  lastUpdated: null,
  isUpdating: false,
  configured: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DiscoverHeaderSection", () => {
  it("returns null when data is undefined and not loading", () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: false });
    const { toJSON } = render(<DiscoverHeaderSection onTagPress={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it("renders Top Tags skeleton while loading", () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true });
    const { getByText } = render(
      <DiscoverHeaderSection onTagPress={jest.fn()} />,
    );
    expect(getByText("Top Tags")).toBeTruthy();
  });

  it("returns null when configured is false", () => {
    mockHook.mockReturnValue({
      data: { ...baseData, configured: false },
    });
    const { toJSON } = render(<DiscoverHeaderSection onTagPress={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it("renders subtitle and 'Updated' when lastUpdated is present", () => {
    mockHook.mockReturnValue({
      data: { ...baseData, lastUpdated: "2026-04-20T00:00:00Z" },
    });

    const { queryByText, getByText } = render(
      <DiscoverHeaderSection onTagPress={jest.fn()} />,
    );

    expect(
      queryByText("Your daily mix, curated from your library."),
    ).toBeTruthy();
    expect(getByText(/Updated /)).toBeTruthy();
  });

  it("renders top genres as tag pills that fire onTagPress", () => {
    mockHook.mockReturnValue({
      data: { ...baseData, topGenres: ["rock", "jazz"] },
    });
    const onPress = jest.fn();

    const { getByText } = render(
      <DiscoverHeaderSection onTagPress={onPress} />,
    );

    fireEvent.press(getByText("#rock"));
    expect(onPress).toHaveBeenCalledWith("rock");
  });

  it("renders basedOn line when basedOn is non-empty", () => {
    mockHook.mockReturnValue({
      data: {
        ...baseData,
        basedOn: [{ name: "Radiohead" }, { name: "Portishead" }],
      },
    });

    const { getByText } = render(
      <DiscoverHeaderSection onTagPress={jest.fn()} />,
    );
    expect(getByText("Based on Radiohead and Portishead")).toBeTruthy();
  });

  it("omits basedOn line when basedOn is empty", () => {
    mockHook.mockReturnValue({ data: { ...baseData, basedOn: [] } });

    const { queryByText } = render(
      <DiscoverHeaderSection onTagPress={jest.fn()} />,
    );
    expect(queryByText(/Based on /)).toBeNull();
  });
});
