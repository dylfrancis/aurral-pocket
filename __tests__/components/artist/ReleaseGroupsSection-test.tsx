jest.mock("@/components/library/ReleaseGroupCard", () => ({
  ReleaseGroupCard: ({ releaseGroup }: { releaseGroup: { id: string } }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: `rg-card-${releaseGroup.id}` });
  },
}));

import { render } from "@testing-library/react-native";
import { ReleaseGroupsSection } from "@/components/artist/ReleaseGroupsSection";
import type { PrimaryReleaseType, ReleaseGroup } from "@/lib/types/library";

jest.mock("@/components/artist/AlbumCategoryList", () => ({
  AlbumCategoryList: ({
    label,
    items,
  }: {
    label: string;
    items: unknown[];
  }) => {
    const React = require("react");
    const { View, Text } = require("react-native");
    return React.createElement(
      View,
      { testID: `category-${label}` },
      React.createElement(Text, null, `${label}: ${items.length}`),
    );
  },
}));

jest.mock("@/components/artist/AlbumCategorySkeleton", () => ({
  AlbumCategorySkeleton: () => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "album-category-skeleton" });
  },
}));

const rg = (
  id: string,
  primary: PrimaryReleaseType = "Album",
): ReleaseGroup => ({
  id,
  title: `Title ${id}`,
  "first-release-date": "2020-01-01",
  "primary-type": primary,
  "secondary-types": [],
});

describe("ReleaseGroupsSection", () => {
  it("renders skeleton when grouped is null and isLoading is true", () => {
    const { queryByTestId, queryByText } = render(
      <ReleaseGroupsSection
        grouped={null}
        isLoading
        onPress={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(queryByTestId("album-category-skeleton")).toBeTruthy();
    expect(queryByText("Albums & Releases")).toBeTruthy();
  });

  it("renders skeleton when grouped is an empty Map and isLoading is true (placeholder case)", () => {
    const { queryByTestId, queryByText } = render(
      <ReleaseGroupsSection
        grouped={new Map()}
        isLoading
        onPress={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(queryByTestId("album-category-skeleton")).toBeTruthy();
    expect(queryByText("Albums & Releases")).toBeTruthy();
  });

  it("renders nothing when grouped is an empty Map and isLoading is false", () => {
    const { queryByTestId, queryByText, toJSON } = render(
      <ReleaseGroupsSection
        grouped={new Map()}
        isLoading={false}
        onPress={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(queryByTestId("album-category-skeleton")).toBeNull();
    expect(queryByText("Albums & Releases")).toBeNull();
    expect(toJSON()).toBeNull();
  });

  it("renders nothing when grouped is null and isLoading is false", () => {
    const { toJSON } = render(
      <ReleaseGroupsSection
        grouped={null}
        isLoading={false}
        onPress={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it("renders categories when populated and isLoading is false", () => {
    const grouped = new Map<PrimaryReleaseType, ReleaseGroup[]>([
      ["Album", [rg("a"), rg("b")]],
      ["EP", [rg("c", "EP")]],
    ]);

    const { queryByTestId, queryByText } = render(
      <ReleaseGroupsSection
        grouped={grouped}
        isLoading={false}
        onPress={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(queryByTestId("album-category-skeleton")).toBeNull();
    expect(queryByText("Albums & Releases")).toBeTruthy();
    expect(queryByTestId("category-Albums")).toBeTruthy();
    expect(queryByTestId("category-EPs")).toBeTruthy();
  });

  it("skips categories with no items", () => {
    const grouped = new Map<PrimaryReleaseType, ReleaseGroup[]>([
      ["Album", [rg("a")]],
      ["EP", []],
    ]);

    const { queryByTestId } = render(
      <ReleaseGroupsSection
        grouped={grouped}
        isLoading={false}
        onPress={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );

    expect(queryByTestId("category-Albums")).toBeTruthy();
    expect(queryByTestId("category-EPs")).toBeNull();
  });
});
