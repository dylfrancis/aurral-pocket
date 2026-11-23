import { useEffect, useMemo, useState, type ReactElement } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  type ErrorBoundaryProps,
} from "expo-router";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { useDiscovery, useRecentlyAdded } from "@/hooks/discover";
import { useRecommendations } from "@/hooks/discover/use-recommendations";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { useGridListView } from "@/hooks/use-grid-list-view";
import { useItemActions } from "@/components/actions/item-actions-context";
import { HorizontalArtistCard } from "@/components/discover/HorizontalArtistCard";
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
import { recentlyAddedMbid } from "@/lib/discover/format";
import { artistRouteId } from "@/lib/library-read";
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

type Kind = "recommended" | "recently-added";

const EDGE_PADDING = 16;

const TITLES: Record<Kind, string> = {
  recommended: "Recommended",
  "recently-added": "Recently Added",
};

function isValidKind(v: unknown): v is Kind {
  return v === "recommended" || v === "recently-added";
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

  // The whole list, as the Discover sections pass it, so they share a lookup.
  // Recently added artists are all in the Library, so they need none.
  const { isInLibrary } = useLibraryLookup(
    kind === "recommended"
      ? (discovery.data?.recommendations ?? []).map((artist) => artist.id)
      : [],
  );

  useEffect(() => {
    navigation.setOptions({
      title: kind ? TITLES[kind] : "Discover",
    });
  }, [navigation, kind]);

  const openArtist = useOpenArtist();
  const itemActions = useItemActions();

  const isLoading = useMemo(() => {
    switch (kind) {
      case "recommended":
        return discovery.isLoading;
      case "recently-added":
        return recentlyAdded.isLoading;
      default:
        return false;
    }
  }, [kind, discovery.isLoading, recentlyAdded.isLoading]);

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
        <AlbumCategorySkeleton shape="circle" />
        <AlbumCategorySkeleton shape="circle" />
      </View>
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
            const open = () =>
              openArtist({ mbid: artistRouteId(item), name: item.artistName });
            const openActions = () =>
              itemActions.openArtist({
                ref: artistRouteId(item),
                name: item.artistName,
              });
            if (!isGrid) {
              return (
                <MediaRow
                  imageType="artist"
                  mbid={mbid}
                  title={item.artistName}
                  subtitle={formatAdded(item.addedAt || item.added)}
                  onPress={open}
                  onLongPress={openActions}
                />
              );
            }
            return (
              <HorizontalArtistCard
                mbid={mbid}
                name={item.artistName}
                subtitle={formatAdded(item.addedAt || item.added)}
                fill
                onPress={open}
                onLongPress={openActions}
              />
            );
          }}
        />
      </>
    );
  }

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
        items={recommendedArtists}
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
                onLongPress={() =>
                  itemActions.openArtist({ ref: item.id, name: item.name })
                }
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
              onLongPress={() =>
                itemActions.openArtist({ ref: item.id, name: item.name })
              }
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
