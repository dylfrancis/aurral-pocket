const mockSetOptions = jest.fn();
let mockParams: Record<string, string> = {};

// Menus render their actions as plain buttons, so a test can pick one.
jest.mock("expo-router", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  const Passthrough = ({ children }: { children?: unknown }) =>
    React.createElement(React.Fragment, null, children);
  return {
    Stack: {
      Screen: () => null,
      Toolbar: Object.assign(Passthrough, {
        Menu: Passthrough,
        MenuAction: ({
          children,
          onPress,
        }: {
          children: string;
          onPress: () => void;
        }) =>
          React.createElement(
            Pressable,
            { accessibilityRole: "menuitem", onPress },
            React.createElement(Text, null, children),
          ),
      }),
    },
    useLocalSearchParams: () => mockParams,
    useNavigation: () => ({ setOptions: mockSetOptions }),
    useRouter: () => ({ push: jest.fn() }),
  };
});

jest.mock("@/hooks/discover", () => ({
  useDiscovery: jest.fn(),
  useRecentlyAdded: () => ({ data: undefined, isLoading: false }),
  useRecentReleases: () => ({ data: undefined, isLoading: false }),
}));

jest.mock("@/hooks/search/use-library-lookup", () => ({
  useLibraryLookup: () => ({ isInLibrary: () => false }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "dark",
}));

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

// The real pills are SwiftUI and Compose views.
jest.mock("@/components/ui/PillRow", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    PillRow: ({ items, selected, onSelect }: any) =>
      React.createElement(
        View,
        null,
        items.map((item: any) =>
          React.createElement(
            Pressable,
            {
              key: item.id,
              accessibilityRole: "tab",
              accessibilityState: { selected: item.id === selected },
              onPress: () => onSelect(item.id),
            },
            React.createElement(Text, null, `${item.label} ${item.count}`),
          ),
        ),
      ),
  };
});

jest.mock("@/components/artist/AlbumCategorySkeleton", () => ({
  AlbumCategorySkeleton: () => null,
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import DiscoverListScreen from "@/app/(app)/(tabs)/(discover)/list/[kind]";
import { useDiscovery } from "@/hooks/discover";
import type { DiscoveryArtist } from "@/lib/types/search";

const artist = (
  name: string,
  overrides: Partial<DiscoveryArtist> = {},
): DiscoveryArtist => ({
  id: name.toLowerCase(),
  name,
  tags: [],
  matchedTags: [],
  sourceArtist: null,
  sourceArtists: [],
  supportingSeeds: [{ artistName: "Slowdive" }],
  discoveryTier: null,
  discoveryDepth: 1,
  firstDiscoveredAt: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (useDiscovery as jest.Mock).mockReturnValue({
    data: {
      recommendations: [
        artist("Ride"),
        artist("Codeine", { supportingSeeds: [{ artistName: "Low" }] }),
        artist("Lush"),
      ],
      globalTop: [],
      basedOn: [{ name: "Slowdive" }, { name: "Low" }],
      topTags: [],
      topGenres: [],
      lastUpdated: null,
      configured: true,
    },
    dataUpdatedAt: Date.parse("2026-11-09T12:00:00Z"),
    isLoading: false,
  });
});

const names = () =>
  screen
    .getAllByText(/^(Ride|Codeine|Lush)$/)
    .map((node) => node.props.children);

describe("Recommended list", () => {
  it("opens on a rail's filter and switches filters from the pills", async () => {
    mockParams = { kind: "recommended", filter: "seed", value: "Slowdive" };
    await render(<DiscoverListScreen />);

    expect(mockSetOptions).toHaveBeenCalledWith({ title: "Recommended" });
    expect(
      screen.getByRole("tab", { name: "Because you like Slowdive 2" }).props,
    ).toMatchObject({ accessibilityState: { selected: true } });
    expect(names()).toEqual(["Ride", "Lush"]);
    expect(screen.getAllByText("like Slowdive")).toHaveLength(2);

    await fireEvent.press(screen.getByText("Close to home 3"));

    expect(names()).toEqual(["Ride", "Codeine", "Lush"]);
    expect(screen.getByText("like Low")).toBeTruthy();
  });

  it("sorts from the toolbar menu", async () => {
    mockParams = { kind: "recommended", filter: "all" };
    await render(<DiscoverListScreen />);
    expect(names()).toEqual(["Ride", "Codeine", "Lush"]);

    await fireEvent.press(screen.getByText("Name A-Z"));

    expect(names()).toEqual(["Codeine", "Lush", "Ride"]);
  });
});
