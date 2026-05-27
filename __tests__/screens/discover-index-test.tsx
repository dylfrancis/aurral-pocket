jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "dark"),
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => () => true,
}));

jest.mock("@/hooks/discover", () => ({
  useDiscovery: jest.fn(() => ({
    data: {
      recommendations: [{ id: "x" }],
      globalTop: [{ id: "y" }],
      topGenres: ["rock"],
      topTags: ["rock"],
      configured: true,
    },
    refetch: jest.fn(),
  })),
  useRecentlyAdded: jest.fn(() => ({ refetch: jest.fn() })),
  useRecentReleases: jest.fn(() => ({ refetch: jest.fn() })),
  useDiscoverLayout: jest.fn(),
}));

jest.mock("@/components/discover", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  const stub = (label: string) => {
    const Stub = () =>
      React.createElement(Text, { testID: `section-${label}` }, label);
    Stub.displayName = `Stub(${label})`;
    return Stub;
  };
  const HeaderStub = () =>
    React.createElement(View, { testID: "section-header" });
  HeaderStub.displayName = "DiscoverHeaderStub";
  return {
    DiscoverHeaderSection: HeaderStub,
    RecentlyAddedSection: stub("recentlyAdded"),
    ShowsNearYouSection: stub("recommendedShows"),
    RecentReleasesSection: stub("recentReleases"),
    RecommendedForYouSection: stub("recommended"),
    GlobalTrendingSection: stub("globalTop"),
    GenreSectionsPanel: stub("genreSections"),
    ExploreByTagSection: stub("topTags"),
    CustomizeDiscoverSheet: () => null,
  };
});

jest.mock("@/components/settings/SettingsSheet", () => ({
  SettingsSheet: () => null,
}));

jest.mock("@/components/shazam", () => ({
  ShazamSheet: () => null,
  ShazamTriggerButton: () => null,
}));

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  const BottomSheetModal = React.forwardRef(function MockBottomSheetModal(
    { children, ...props }: any,
    ref: any,
  ) {
    React.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: jest.fn(),
    }));
    return React.createElement(View, props, children);
  });
  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetBackdrop: (props: any) => React.createElement(View, props),
    BottomSheetView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import React from "react";
import { render } from "@testing-library/react-native";
import DiscoverScreen from "@/app/(app)/(tabs)/(discover)/index";
import { useDiscoverLayout } from "@/hooks/discover";

const mockUseDiscoverLayout = useDiscoverLayout as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DiscoverScreen layout", () => {
  it("renders no customizable sections until layout is hydrated", () => {
    mockUseDiscoverLayout.mockReturnValue({
      sections: [],
      hydrated: false,
      saveLayout: jest.fn(),
    });

    const { queryByTestId } = render(<DiscoverScreen />);
    expect(queryByTestId("section-header")).toBeTruthy();
    expect(queryByTestId("section-recentlyAdded")).toBeNull();
    expect(queryByTestId("section-topTags")).toBeNull();
  });

  it("renders only enabled sections in layout order", () => {
    mockUseDiscoverLayout.mockReturnValue({
      sections: [
        { id: "topTags", label: "Explore by Tag", enabled: true },
        { id: "recentlyAdded", label: "Recently Added", enabled: false },
        { id: "recommended", label: "Recommended for You", enabled: true },
      ],
      hydrated: true,
      saveLayout: jest.fn(),
    });

    const { queryByTestId, getAllByTestId } = render(<DiscoverScreen />);
    expect(queryByTestId("section-recentlyAdded")).toBeNull();
    expect(queryByTestId("section-topTags")).toBeTruthy();
    expect(queryByTestId("section-recommended")).toBeTruthy();

    const renderedIds = getAllByTestId(/^section-/).map(
      (node) => node.props.testID,
    );
    const customizableIds = renderedIds.filter((id) => id !== "section-header");
    expect(customizableIds).toEqual(["section-topTags", "section-recommended"]);
  });
});
