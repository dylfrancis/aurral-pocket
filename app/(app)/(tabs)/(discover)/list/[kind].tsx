import { useEffect, useMemo, useState, type ReactElement } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  type ErrorBoundaryProps,
} from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import {
  useDiscovery,
  useRecentlyAdded,
  useRecentReleases,
} from "@/hooks/discover";
import { useRecommendations } from "@/hooks/discover/use-recommendations";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { useGridListView } from "@/hooks/use-grid-list-view";
import { HorizontalArtistCard } from "@/components/discover/HorizontalArtistCard";
import { DiscoverReleaseCard } from "@/components/discover/DiscoverReleaseCard";
import { RECOMMENDED_SORT_OPTIONS } from "@/components/discover/recommended-sort";
import { EmptyState } from "@/components/library/EmptyState";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { Chip } from "@/components/ui/Chip";
import { PillRow } from "@/components/ui/PillRow";
import { MediaRow } from "@/components/ui/MediaRow";
import {
  FILTER_MENU_ICON,
  menuOptionSection,
} from "@/components/ui/MenuOptions";
import { formatDate } from "@/lib/date-time";
import { formatReleaseStatus, recentlyAddedMbid } from "@/lib/discover/format";
import {
  filterKey,
  parseRecommendedFilter,
  recommendationReason,
  recommendedFilterOptions,
  recommendedRows,
  type RecommendedSort,
} from "@/lib/discover/recommended";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { useColors } from "@/hooks/use-colors";

type Kind = "recommended" | "trending" | "recently-added" | "recent-releases";

const EDGE_PADDING = 16;

const TITLES: Record<Kind, string> = {
  recommended: "Recommended",
  trending: "Global Trending",
  "recently-added": "Recently Added",
  "recent-releases": "Recent & Upcoming Releases",
};

function isValidKind(v: unknown): v is Kind {
  return (
    v === "recommended" ||
    v === "trending" ||
    v === "recently-added" ||
    v === "recent-releases"
  );
}

function formatAdded(date?: string | null) {
  if (!date) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  return `Added ${formatDate(d)}`;
}

const SPACER = "__spacer__" as const;
type WithSpacer<T> = T | typeof SPACER;

// Pads the last row so every cell keeps an equal flex width.
function padForGrid<T>(items: T[], columns: number): WithSpacer<T>[] {
  const remainder = items.length % columns;
  if (remainder === 0) return items;
  return [
    ...items,
    ...Array.from({ length: columns - remainder }, () => SPACER),
  ];
}

function SpacerCell() {
  return <View style={styles.spacer} />;
}

export default function DiscoverListScreen() {
  const {
    kind: kindParam,
    filter: filterParam,
    value: valueParam,
  } = useLocalSearchParams<{ kind: string; filter?: string; value?: string }>();
  const navigation = useNavigation();
  const colors = useColors();
  // Repaint the dates in this list when the server format changes.
  useDateTimeFormat();

  const kind: Kind | null = isValidKind(kindParam) ? kindParam : null;

  const { isGrid, numColumns, viewMenuSection } = useGridListView(
    `discover-${kind ?? "unknown"}`,
    "grid",
    EDGE_PADDING,
  );

  const discovery = useDiscovery();
  const recentlyAdded = useRecentlyAdded();
  const recentReleases = useRecentReleases();

  const {
    recommendations,
    topGenres,
    context: recommendedContext,
  } = useRecommendations();
  const [recommendedFilter, setRecommendedFilter] = useState(() =>
    parseRecommendedFilter(filterParam, valueParam),
  );
  const [sort, setSort] = useState<RecommendedSort>("rank");
  const filterOptions = useMemo(
    () =>
      kind === "recommended"
        ? recommendedFilterOptions(
            recommendations,
            topGenres,
            recommendedContext,
            recommendedFilter,
          )
        : [],
    [kind, recommendations, topGenres, recommendedContext, recommendedFilter],
  );
  const recommendedArtists = useMemo(
    () =>
      kind === "recommended"
        ? recommendedRows(
            recommendations,
            recommendedFilter,
            sort,
            recommendedContext,
          ).map((row) => row.artist)
        : [],
    [kind, recommendations, recommendedFilter, sort, recommendedContext],
  );

  const discoveryArtists =
    (kind === "recommended"
      ? discovery.data?.recommendations
      : kind === "trending"
        ? discovery.data?.globalTop
        : undefined) ?? [];
  // The whole list, as the Discover sections pass it, so they share a lookup.
  const { isInLibrary } = useLibraryLookup(
    kind === "recently-added"
      ? (recentlyAdded.data ?? []).map(recentlyAddedMbid)
      : discoveryArtists.map((artist) => artist.id),
  );

  useEffect(() => {
    navigation.setOptions({
      title: kind ? TITLES[kind] : "Discover",
    });
  }, [navigation, kind]);

  const openArtist = useOpenArtist();

  const isLoading = useMemo(() => {
    switch (kind) {
      case "recommended":
      case "trending":
        return discovery.isLoading;
      case "recently-added":
        return recentlyAdded.isLoading;
      case "recent-releases":
        return recentReleases.isLoading;
      default:
        return false;
    }
  }, [
    kind,
    discovery.isLoading,
    recentlyAdded.isLoading,
    recentReleases.isLoading,
  ]);

  const viewToolbar = (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon={FILTER_MENU_ICON}>
        {kind === "recommended"
          ? menuOptionSection(
              "Sort by",
              RECOMMENDED_SORT_OPTIONS,
              sort,
              setSort,
            )
          : null}
        {viewMenuSection}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );

  if (!kind) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Discover" }} />
        <EmptyState icon="alert-circle-outline" message="Unknown list" />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        {viewToolbar}
        <AlbumCategorySkeleton />
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (kind === "recent-releases") {
    return (
      <>
        {viewToolbar}
        <KindList
          items={recentReleases.data ?? []}
          isGrid={isGrid}
          columns={numColumns}
          backgroundColor={colors.background}
          keyOf={(item, index) =>
            item.id ||
            item.mbid ||
            item.foreignAlbumId ||
            `${item.albumName}-${index}`
          }
          renderCell={(item) => {
            const onPress = () => {
              const mbid =
                item.artistMbid || item.foreignArtistId || item.artistId || "";
              openArtist({ mbid, name: item.artistName });
            };
            if (!isGrid) {
              return (
                <MediaRow
                  imageType="album"
                  mbid={item.mbid || item.foreignAlbumId}
                  title={item.albumName || item.title || "Untitled"}
                  subtitle={[
                    item.artistName || "Unknown Artist",
                    formatReleaseStatus(item.releaseDate),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onPress={onPress}
                />
              );
            }
            return <DiscoverReleaseCard album={item} fill onPress={onPress} />;
          }}
        />
      </>
    );
  }

  if (kind === "recently-added") {
    return (
      <>
        {viewToolbar}
        <KindList
          items={recentlyAdded.data ?? []}
          isGrid={isGrid}
          columns={numColumns}
          backgroundColor={colors.background}
          keyOf={(item) => item.id}
          renderCell={(item) => {
            const mbid = recentlyAddedMbid(item);
            if (!isGrid) {
              return (
                <MediaRow
                  imageType="artist"
                  mbid={mbid}
                  title={item.artistName}
                  subtitle={formatAdded(item.addedAt || item.added)}
                  trailing={
                    isInLibrary(mbid) ? (
                      <Chip label="In Library" variant="brand" />
                    ) : undefined
                  }
                  onPress={() => openArtist({ mbid, name: item.artistName })}
                />
              );
            }
            return (
              <HorizontalArtistCard
                mbid={mbid}
                name={item.artistName}
                subtitle={formatAdded(item.addedAt || item.added)}
                isInLibrary={isInLibrary(mbid)}
                fill
                onPress={() => openArtist({ mbid, name: item.artistName })}
              />
            );
          }}
        />
      </>
    );
  }

  const artists =
    kind === "recommended" ? recommendedArtists : discoveryArtists;
  const filterPills =
    kind === "recommended" ? (
      <View style={isGrid ? styles.gridPills : styles.listPills}>
        <PillRow
          items={filterOptions.map((option) => ({
            id: option.key,
            label: option.label,
            count: option.count,
          }))}
          selected={filterKey(recommendedFilter)}
          onSelect={(key) => {
            const option = filterOptions.find((entry) => entry.key === key);
            if (option) setRecommendedFilter(option.filter);
          }}
        />
      </View>
    ) : undefined;

  return (
    <>
      {viewToolbar}
      <KindList
        items={artists}
        isGrid={isGrid}
        columns={numColumns}
        backgroundColor={colors.background}
        header={filterPills}
        keyOf={(item) => item.id}
        renderCell={(item) => {
          const subtitle =
            kind === "recommended"
              ? recommendationReason(item, recommendedContext.seeds)
              : item.sourceArtist
                ? `Similar to ${item.sourceArtist}`
                : undefined;
          if (!isGrid) {
            return (
              <MediaRow
                imageType="artist"
                mbid={item.id}
                title={item.name}
                subtitle={subtitle}
                trailing={
                  isInLibrary(item.id) ? (
                    <Chip label="In Library" variant="brand" />
                  ) : undefined
                }
                onPress={() => openArtist({ mbid: item.id, name: item.name })}
              />
            );
          }
          return (
            <HorizontalArtistCard
              mbid={item.id}
              name={item.name}
              subtitle={subtitle}
              isInLibrary={isInLibrary(item.id)}
              fill
              onPress={() => openArtist({ mbid: item.id, name: item.name })}
            />
          );
        }}
      />
    </>
  );
}

type KindListProps<T> = {
  items: T[];
  isGrid: boolean;
  columns: number;
  backgroundColor: string;
  keyOf: (item: T, index: number) => string;
  renderCell: (item: T) => ReactElement;
  header?: ReactElement;
};

/** One kind's rows or grid; the grid pads its last row with spacers. */
function KindList<T>({
  items,
  isGrid,
  columns,
  backgroundColor,
  keyOf,
  renderCell,
  header,
}: KindListProps<T>) {
  return (
    <FlatList<WithSpacer<T>>
      key={`${isGrid}-${columns}`}
      data={isGrid ? padForGrid(items, columns) : items}
      keyExtractor={(item, index) =>
        item === SPACER ? `spacer-${index}` : keyOf(item, index)
      }
      numColumns={isGrid ? columns : 1}
      columnWrapperStyle={isGrid ? styles.row : undefined}
      contentContainerStyle={[
        isGrid ? styles.content : styles.rowsContent,
        { backgroundColor },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={header}
      renderItem={({ item }) =>
        item === SPACER ? <SpacerCell /> : renderCell(item)
      }
      ListEmptyComponent={
        <EmptyState icon="disc-outline" message="Nothing here yet" />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: EDGE_PADDING,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
  },
  rowsContent: {
    paddingTop: 12,
    paddingBottom: 32,
  },
  row: {
    gap: 12,
  },
  spacer: {
    flex: 1,
  },
  // The pills scroll edge to edge, past the grid's padding.
  gridPills: {
    marginHorizontal: -EDGE_PADDING,
  },
  listPills: {
    paddingBottom: 8,
  },
  loading: {
    flex: 1,
    paddingTop: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load list" />;
}
