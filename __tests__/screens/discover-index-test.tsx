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

jest.mock("@expo/material-symbols/mic.xml", () => "Mic");

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  Stack: {
    Screen: () => null,
    Toolbar: Object.assign(() => null, { Button: () => null }),
  },
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("expo-router/react-navigation", () => ({
  useHeaderHeight: () => 0,
}));

const mockRefetchDiscovery = jest.fn();
jest.mock("@/hooks/discover", () => ({
  useDiscovery: jest.fn(() => ({
    data: {
      recommendations: [{ id: "x" }],
      globalTop: [{ id: "y" }],
      topGenres: ["rock"],
      topTags: ["rock"],
      configured: true,
    },
    refetch: mockRefetchDiscovery,
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
  const viewAllStub = (label: string) => {
    const Stub = ({ onViewAll }: { onViewAll: () => void }) =>
      React.createElement(
        Text,
        { testID: `section-${label}`, onPress: onViewAll },
        label,
      );
    Stub.displayName = `ViewAllStub(${label})`;
    return Stub;
  };
  return {
    DiscoverHeaderSection: HeaderStub,
    RecentlyAddedSection: stub("recentlyAdded"),
    ShowsNearYouSection: stub("recommendedShows"),
    RecentReleasesSection: stub("recentReleases"),
    RecommendedForYouSection: viewAllStub("recommended"),
    GlobalTrendingSection: stub("globalTop"),
    GenreSectionsPanel: stub("genreSections"),
    EditorialPlaylistsSection: viewAllStub("playlists"),
    CustomizeDiscoverSheet: () => null,
  };
});

// The real pills are SwiftUI and Compose views.
jest.mock("@/components/discover/DiscoverTabs", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  const { DISCOVER_TABS } = jest.requireActual(
    "@/components/discover/discover-tabs",
  );
  return {
    DiscoverTabs: ({
      selected,
      onSelect,
    }: {
      selected: string;
      onSelect: (tab: string) => void;
    }) =>
      React.createElement(
        View,
        null,
        DISCOVER_TABS.map((tab: { id: string; label: string }) =>
          React.createElement(
            Pressable,
            {
              key: tab.id,
              accessibilityRole: "tab",
              accessibilityState: { selected: tab.id === selected },
              onPress: () => onSelect(tab.id),
            },
            React.createElement(Text, null, tab.label),
          ),
        ),
      ),
  };
});

let mockShelfBuilds = 0;
jest.mock("@/components/discover/EditorialShelf", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    EditorialShelf: () => {
      // Runs once per mount; a remount would count again.
      React.useState(() => ++mockShelfBuilds);
      return <Text testID="tab-playlists" />;
    },
  };
});

jest.mock("@/components/discover/RecommendedTab", () => {
  const { Text } = require("react-native");
  return {
    RecommendedTab: ({
      onShowList,
    }: {
      onShowList: (filter: unknown) => void;
    }) => (
      <Text
        testID="tab-recommended"
        onPress={() => onShowList({ kind: "seed", value: "Slowdive" })}
      />
    ),
  };
});

jest.mock("@/components/discover/TrendingCharts", () => {
  const { Text } = require("react-native");
  return { TrendingCharts: () => <Text testID="tab-trending" /> };
});

jest.mock("@/hooks/use-open-overflow-screen", () => ({
  useOpenOverflowScreen: () => jest.fn(),
}));

jest.mock("@/components/navigation/OverflowMenu", () => ({
  OverflowMenu: () => null,
}));

jest.mock("@/components/shazam", () => ({
  ShazamSheet: () => null,
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

const mockInvalidateQueries = jest.fn(() => Promise.resolve());
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import DiscoverScreen from "@/app/(app)/(tabs)/(discover)/index";
import { useDiscoverLayout } from "@/hooks/discover";
import { discoverKeys } from "@/lib/query-keys";

const mockUseDiscoverLayout = useDiscoverLayout as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DiscoverScreen layout", () => {
  it("renders no customizable sections until layout is hydrated", async () => {
    mockUseDiscoverLayout.mockReturnValue({
      sections: [],
      hydrated: false,
      saveLayout: jest.fn(),
    });

    const { queryByTestId } = await render(<DiscoverScreen />);
    expect(queryByTestId("section-header")).toBeTruthy();
    expect(queryByTestId("section-recentlyAdded")).toBeNull();
    expect(queryByTestId("section-playlists")).toBeNull();
  });

  it("renders only enabled sections in layout order", async () => {
    mockUseDiscoverLayout.mockReturnValue({
      sections: [
        { id: "playlists", label: "Playlists", enabled: true },
        { id: "recentlyAdded", label: "Recently Added", enabled: false },
        { id: "recommended", label: "Recommended for You", enabled: true },
      ],
      hydrated: true,
      saveLayout: jest.fn(),
    });

    const { queryByTestId, getAllByTestId } = await render(<DiscoverScreen />);
    expect(queryByTestId("section-recentlyAdded")).toBeNull();
    expect(queryByTestId("section-playlists")).toBeTruthy();
    expect(queryByTestId("section-recommended")).toBeTruthy();

    const renderedIds = getAllByTestId(/^section-/).map(
      (node) => node.props.testID,
    );
    const customizableIds = renderedIds.filter((id) => id !== "section-header");
    expect(customizableIds).toEqual([
      "section-playlists",
      "section-recommended",
    ]);
  });
});

describe("DiscoverScreen tabs", () => {
  beforeEach(() => {
    mockUseDiscoverLayout.mockReturnValue({
      sections: [{ id: "playlists", label: "Playlists", enabled: true }],
      hydrated: true,
      saveLayout: jest.fn(),
    });
  });

  it("opens on For You and swaps in each tab's content", async () => {
    await render(<DiscoverScreen />);
    expect(screen.getByRole("tab", { name: "For You" }).props).toMatchObject({
      accessibilityState: { selected: true },
    });
    expect(screen.getByTestId("section-playlists")).toBeTruthy();

    await fireEvent.press(screen.getByText("Trending"));
    expect(screen.getByTestId("tab-trending")).toBeTruthy();
    expect(screen.queryByTestId("section-header")).toBeNull();
    expect(screen.queryByTestId("section-playlists")).toBeNull();

    await fireEvent.press(screen.getByText("Playlists"));
    expect(screen.getByTestId("tab-playlists")).toBeTruthy();
    expect(screen.queryByTestId("tab-trending")).toBeNull();
  });

  it("keeps a tab built while another one shows", async () => {
    mockShelfBuilds = 0;
    await render(<DiscoverScreen />);

    await fireEvent.press(screen.getByText("Playlists"));
    await fireEvent.press(screen.getByText("Trending"));
    await fireEvent.press(screen.getByText("Playlists"));

    expect(screen.getByTestId("tab-playlists")).toBeTruthy();
    expect(mockShelfBuilds).toBe(1);
  });

  it("opens the Playlists tab from the Playlists row's View All", async () => {
    await render(<DiscoverScreen />);

    await fireEvent.press(screen.getByTestId("section-playlists"));

    expect(screen.getByTestId("tab-playlists")).toBeTruthy();
    expect(screen.queryByTestId("section-header")).toBeNull();
  });

  it("opens the Recommended tab from the Recommended row's View All", async () => {
    mockUseDiscoverLayout.mockReturnValue({
      sections: [{ id: "recommended", label: "Recommended", enabled: true }],
      hydrated: true,
      saveLayout: jest.fn(),
    });
    await render(<DiscoverScreen />);

    await fireEvent.press(screen.getByTestId("section-recommended"));

    expect(screen.getByTestId("tab-recommended")).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Recommended" }).props,
    ).toMatchObject({ accessibilityState: { selected: true } });
    expect(screen.queryByTestId("section-header")).toBeNull();
  });

  it("opens a Recommended rail's full list", async () => {
    await render(<DiscoverScreen />);
    await fireEvent.press(screen.getByText("Recommended"));

    await fireEvent.press(screen.getByTestId("tab-recommended"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(discover)/list/[kind]",
      params: { kind: "recommended", filter: "seed", value: "Slowdive" },
    });
  });

  it("reloads only the open tab on pull to refresh", async () => {
    await render(<DiscoverScreen />);
    await fireEvent.press(screen.getByText("Trending"));

    // React Native's jest mock keeps the mounted control, not its props, in
    // the host tree.
    const { RefreshControl } = require("react-native");
    await act(() => RefreshControl.latestRef.props.onRefresh());

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: discoverKeys.trending(),
    });
    expect(mockRefetchDiscovery).not.toHaveBeenCalled();
  });

  it("reloads recommendations on pull to refresh in Recommended", async () => {
    await render(<DiscoverScreen />);
    await fireEvent.press(screen.getByText("Recommended"));

    const { RefreshControl } = require("react-native");
    await act(() => RefreshControl.latestRef.props.onRefresh());

    expect(mockRefetchDiscovery).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
