jest.mock("@/hooks/discover", () => ({
  useDiscovery: jest.fn(),
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

jest.mock("@/components/artist/AlbumCategorySkeleton", () => ({
  AlbumCategorySkeleton: () => null,
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { RecommendedTab } from "@/components/discover/RecommendedTab";
import { useDiscovery } from "@/hooks/discover";
import type { RecommendedFilter } from "@/lib/discover/recommended";
import type { DiscoveryArtist } from "@/lib/types/search";

const mockUseDiscovery = useDiscovery as jest.Mock;

const artist = (
  name: string,
  overrides: Partial<DiscoveryArtist> = {},
): DiscoveryArtist => ({
  id: name.toLowerCase(),
  name,
  tags: [],
  matchedTags: ["shoegaze", "slowcore"],
  sourceArtist: null,
  sourceArtists: [],
  supportingSeeds: [{ artistName: "Slowdive" }],
  discoveryTier: null,
  discoveryDepth: 1,
  firstDiscoveredAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const RECOMMENDATIONS = [
  artist("Lush", {
    matchedTags: ["dream pop"],
    supportingSeeds: [{ artistName: "Slowdive" }, { artistName: "Low" }],
  }),
  ...["Ride", "Swervedriver", "Chapterhouse", "Moose"].map((name) =>
    artist(name),
  ),
  artist("Codeine", { supportingSeeds: [{ artistName: "Low" }] }),
  artist("Hum", {
    discoveryDepth: 2,
    supportingSeeds: [{ artistName: "Grouper" }],
  }),
];

// Rails below the fold build one per frame; the genre rail comes last.
async function renderTab(onShowList: (filter: RecommendedFilter) => void) {
  await render(
    <RecommendedTab onArtistPress={jest.fn()} onShowList={onShowList} />,
  );
  await screen.findByText("slowcore");
}

beforeEach(() => {
  mockUseDiscovery.mockReturnValue({
    data: {
      recommendations: RECOMMENDATIONS,
      globalTop: [],
      basedOn: [{ name: "Slowdive" }, { name: "Low" }],
      topTags: [],
      topGenres: ["slowcore"],
      lastUpdated: null,
      configured: true,
    },
    dataUpdatedAt: Date.parse("2026-11-09T12:00:00Z"),
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
});

describe("RecommendedTab", () => {
  it("groups artists by why they showed up and says why on each card", async () => {
    await renderTab(jest.fn());

    expect(screen.getByText("7 recommendations")).toBeTruthy();
    expect(screen.getByText("Top pick")).toBeTruthy();
    expect(screen.getByText("Lush")).toBeTruthy();
    expect(screen.getByText("Because you like Slowdive and Low")).toBeTruthy();
    expect(screen.getByText("dream pop")).toBeTruthy();
    expect(screen.getByText("Because you like Slowdive")).toBeTruthy();
    // A seed rail's title names the seed, so its cards give a genre.
    expect(screen.getAllByText("shoegaze")).toHaveLength(4);
    expect(screen.getByText("Close to home")).toBeTruthy();
    expect(screen.getAllByText("like Low").length).toBeGreaterThan(0);
    expect(screen.getByText("Further out")).toBeTruthy();
    expect(screen.getAllByText("via Grouper").length).toBeGreaterThan(0);
  });

  it("opens every recommendation from See All", async () => {
    const onShowList = jest.fn();
    await renderTab(onShowList);

    await fireEvent.press(screen.getByText("See All"));

    expect(onShowList).toHaveBeenCalledWith({ kind: "all" });
  });

  it("opens a rail's full list from its View All", async () => {
    const onShowList = jest.fn();
    await renderTab(onShowList);

    await fireEvent.press(screen.getByText("Because you like Slowdive"));
    await fireEvent.press(screen.getByText("slowcore"));

    expect(onShowList).toHaveBeenNthCalledWith(1, {
      kind: "seed",
      value: "Slowdive",
    });
    expect(onShowList).toHaveBeenNthCalledWith(2, {
      kind: "genre",
      value: "slowcore",
    });
  });

  it("offers a retry when recommendations didn't load", async () => {
    const refetch = jest.fn();
    mockUseDiscovery.mockReturnValue({
      data: undefined,
      dataUpdatedAt: 0,
      isLoading: false,
      isError: true,
      refetch,
    });
    await render(
      <RecommendedTab onArtistPress={jest.fn()} onShowList={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText("Try Again"));

    expect(refetch).toHaveBeenCalled();
  });
});
