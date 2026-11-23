import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, SectionList, StyleSheet, View } from "react-native";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useItemActions } from "@/components/actions/item-actions-context";
import { recentReleaseTarget } from "@/components/actions/targets";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { DiscoverReleaseCard } from "@/components/discover/DiscoverReleaseCard";
import { EmptyState } from "@/components/library/EmptyState";
import { MediaRow } from "@/components/ui/MediaRow";
import { FILTER_MENU_ICON } from "@/components/ui/MenuOptions";
import { PillRow } from "@/components/ui/PillRow";
import type { PillRowItem } from "@/components/ui/pill-row";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  flattenReleaseFeed,
  useReleaseFeed,
} from "@/hooks/discover/use-release-feed";
import { useColors } from "@/hooks/use-colors";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { useGridListView } from "@/hooks/use-grid-list-view";
import { formatReleaseStatus } from "@/lib/discover/format";
import {
  groupReleasesByMonth,
  recentReleaseRouteParams,
} from "@/lib/discover/releases";
import type { RecentReleaseAlbum, ReleaseWindow } from "@/lib/types/search";

const EDGE_PADDING = 16;

const WHEN_PILLS: readonly PillRowItem<ReleaseWindow>[] = [
  { id: "released", label: "Released" },
  { id: "upcoming", label: "Upcoming" },
];

/** A month's releases, one row per grid line, or one release per row. */
type MonthSection = { title: string; data: RecentReleaseAlbum[][] };

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    rows.push(items.slice(start, start + size));
  }
  return rows;
}

/** The web's Releases page: releases the Library lacks, grouped by month. */
export default function ReleasesScreen() {
  const colors = useColors();
  const router = useRouter();
  // Repaint the dates when the server format changes.
  useDateTimeFormat();

  const [when, setWhen] = useState<ReleaseWindow>("released");
  // Renaming this key drops every saved grid or list choice.
  const { isGrid, numColumns, viewMenuSection } = useGridListView(
    "discover-recent-releases",
    "grid",
    EDGE_PADDING,
  );

  const {
    data,
    error,
    isPending,
    isRefetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useReleaseFeed(when);
  const releases = useMemo(() => flattenReleaseFeed(data), [data]);
  const sections = useMemo<MonthSection[]>(
    () =>
      groupReleasesByMonth(releases).map((group) => ({
        title: group.label,
        data: chunk(group.releases, numColumns),
      })),
    [releases, numColumns],
  );

  // A bare path, so expo-router opens it inside the Discover stack.
  const openRelease = useCallback(
    (album: RecentReleaseAlbum) => {
      router.push({
        pathname: "/release/[mbid]",
        params: recentReleaseRouteParams(album),
      });
    },
    [router],
  );
  const { openAlbum } = useItemActions();
  const openReleaseActions = useCallback(
    (album: RecentReleaseAlbum) => openAlbum(recentReleaseTarget(album)),
    [openAlbum],
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderRow = useCallback(
    ({ item: row }: { item: RecentReleaseAlbum[] }) => {
      if (!isGrid) {
        const album = row[0];
        return (
          <MediaRow
            imageType="album"
            mbid={album.mbid || album.foreignAlbumId}
            coverUrl={album.coverUrl ?? undefined}
            title={album.albumName || album.title || "Untitled"}
            subtitle={[
              album.artistName || "Unknown Artist",
              formatReleaseStatus(album.releaseDate),
            ]
              .filter(Boolean)
              .join(" · ")}
            onPress={() => openRelease(album)}
            onLongPress={() => openReleaseActions(album)}
          />
        );
      }
      return (
        <View style={styles.gridRow}>
          {row.map((album) => (
            <DiscoverReleaseCard
              key={album.id}
              album={album}
              fill
              onPress={() => openRelease(album)}
              onLongPress={() => openReleaseActions(album)}
            />
          ))}
          {/* Spacers keep a short last row's cards the same width. */}
          {Array.from({ length: numColumns - row.length }, (_, index) => (
            <View key={`spacer-${index}`} style={styles.spacer} />
          ))}
        </View>
      );
    },
    [isGrid, numColumns, openRelease, openReleaseActions],
  );

  let emptyContent;
  if (isPending) {
    emptyContent = (
      <View style={styles.loading}>
        <AlbumCategorySkeleton shape="square" />
        <AlbumCategorySkeleton shape="square" />
      </View>
    );
  } else if (error) {
    emptyContent = (
      <EmptyState
        icon="alert-circle-outline"
        message="Couldn’t load releases"
        actionLabel={isRefetching ? undefined : "Try Again"}
        onAction={() => void refetch()}
      />
    );
  } else {
    emptyContent = (
      <EmptyState
        icon="disc-outline"
        message={
          when === "upcoming" ? "No upcoming releases" : "No recent releases"
        }
      />
    );
  }

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon={FILTER_MENU_ICON}>
          {viewMenuSection}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <SectionList
        // A new column count can't reuse the old rows.
        key={`${isGrid}-${numColumns}`}
        sections={sections}
        keyExtractor={(row) => row.map((album) => album.id).join(",")}
        renderItem={renderRow}
        renderSectionHeader={({ section }) => (
          <View style={styles.monthHeader}>
            <SectionHeader title={section.title} />
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.pills}>
            <PillRow items={WHEN_PILLS} selected={when} onSelect={setWhen} />
          </View>
        }
        ListEmptyComponent={emptyContent}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} color={colors.subtle} />
          ) : undefined
        }
        onEndReached={loadMore}
        onEndReachedThreshold={1}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.background },
        ]}
        style={{ backgroundColor: colors.background }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingBottom: 32,
  },
  pills: {
    paddingBottom: 4,
  },
  monthHeader: {
    paddingTop: 16,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: EDGE_PADDING,
    paddingBottom: 16,
  },
  spacer: {
    flex: 1,
  },
  loading: {
    paddingTop: 16,
    gap: 16,
  },
  footer: {
    paddingVertical: 16,
  },
});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load releases" />;
}
