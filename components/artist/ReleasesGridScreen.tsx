import { useCallback } from "react";
import { useRouter } from "expo-router";
import { ReleaseGroupCard } from "@/components/library/ReleaseGroupCard";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { MediaRow } from "@/components/ui/MediaRow";
import { useReleaseGrid } from "@/hooks/library/use-release-grid";
import { releaseRouteParams } from "@/lib/library-read";
import type { ReleaseGroup } from "@/lib/types/library";

function releaseYear(date?: string | null) {
  if (!date) return undefined;
  const year = new Date(date).getFullYear();
  return Number.isFinite(year) ? String(year) : undefined;
}

const releaseConfig = {
  variant: "releases" as const,
  getDate: (rg: ReleaseGroup) => rg["first-release-date"],
  getName: (rg: ReleaseGroup) => rg.title,
  supportsMissing: false,
};

export function ReleasesGridScreen() {
  const grid = useReleaseGrid<ReleaseGroup>(releaseConfig);
  const router = useRouter();

  // A bare path, so expo-router resolves it inside the current tab group.
  const openReleaseGroup = useCallback(
    (rg: ReleaseGroup) => {
      router.push({
        pathname: "/release/[mbid]",
        params: releaseRouteParams({
          mbid: rg.id,
          title: rg.title,
          artistName: grid.artistName,
          artistMbid: grid.artistMbid,
          artistId: grid.artistId,
          primaryType: rg["primary-type"],
          secondaryTypes: rg["secondary-types"],
          releaseDate: rg["first-release-date"],
        }),
      });
    },
    [router, grid.artistName, grid.artistMbid, grid.artistId],
  );

  return (
    <ReleaseGrid
      items={grid.items}
      isLoading={grid.isLoading}
      refreshing={grid.refreshing}
      onRefresh={grid.handleRefresh}
      sortMode={grid.sortMode}
      onSortChange={grid.setSortMode}
      sortOptions={grid.sortOptions}
      searchQuery={grid.searchQuery}
      onSearchChange={grid.setSearchQuery}
      searchPlaceholder="Search releases"
      hasUnderlyingItems={grid.hasUnderlyingItems}
      emptyMessage="No releases to show"
      renderItem={(item) => (
        <ReleaseGroupCard
          releaseGroup={item}
          onPress={() => openReleaseGroup(item)}
          fill
        />
      )}
      renderListItem={(item) => (
        <MediaRow
          imageType="album"
          mbid={item.id}
          title={item.title}
          subtitle={releaseYear(item["first-release-date"])}
          onPress={() => openReleaseGroup(item)}
        />
      )}
      keyExtractor={(item) => item.id}
    />
  );
}
