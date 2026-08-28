import { useCallback, useEffect, useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
  type ErrorBoundaryProps,
} from "expo-router";
import FilterList from "@expo/material-symbols/filter_list.xml";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import {
  useDiscovery,
  useRecentlyAdded,
  useRecentReleases,
} from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { useGridColumns } from "@/hooks/use-grid-columns";
import { useViewMode } from "@/hooks/use-view-mode";
import { HorizontalArtistCard } from "@/components/discover/HorizontalArtistCard";
import { DiscoverReleaseCard } from "@/components/discover/DiscoverReleaseCard";
import { EmptyState } from "@/components/library/EmptyState";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { Chip } from "@/components/ui/Chip";
import { MediaRow } from "@/components/ui/MediaRow";
import { viewModeMenuSection } from "@/components/ui/ViewModeMenuActions";
import { formatDate } from "@/lib/date-time";
import { formatReleaseStatus } from "@/lib/discover/format";
import type {
  DiscoveryArtist,
  RecentlyAddedArtist,
  RecentReleaseAlbum,
} from "@/lib/types/search";

type Kind = "recommended" | "trending" | "recently-added" | "recent-releases";

const EDGE_PADDING = 16;

const TITLES: Record<Kind, string> = {
  recommended: "Recommended For You",
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
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const colors = Colors[useColorScheme()];
  // Repaint the dates in this list when the server format changes.
  useDateTimeFormat();
  const { isInLibrary } = useLibraryLookup();

  const kind: Kind | null = isValidKind(kindParam) ? kindParam : null;

  const [viewMode, setViewMode] = useViewMode(
    `discover-${kind ?? "unknown"}`,
    "grid",
  );
  const gridColumns = useGridColumns(EDGE_PADDING * 2);
  const isGrid = viewMode === "grid";

  const discovery = useDiscovery();
  const recentlyAdded = useRecentlyAdded();
  const recentReleases = useRecentReleases();

  useEffect(() => {
    navigation.setOptions({
      title: kind ? TITLES[kind] : "Discover",
    });
  }, [navigation, kind]);

  const pushArtist = useCallback(
    (mbid: string, name?: string) => {
      if (!mbid) return;
      router.push({
        pathname: "/artist/[mbid]",
        params: { mbid, name: name ?? "" },
      });
    },
    [router],
  );

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
      <Stack.Toolbar.Menu
        icon={
          process.env.EXPO_OS === "ios"
            ? "line.3.horizontal.decrease"
            : FilterList
        }
      >
        {viewModeMenuSection(viewMode, setViewMode)}
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
    const albums = recentReleases.data ?? [];
    return (
      <>
        {viewToolbar}
        <FlatList
          key={`${viewMode}-${gridColumns}`}
          data={isGrid ? padForGrid(albums, gridColumns) : albums}
          keyExtractor={(item, index) =>
            item === SPACER
              ? `spacer-${index}`
              : item.id ||
                item.mbid ||
                item.foreignAlbumId ||
                `${item.albumName}-${index}`
          }
          numColumns={isGrid ? gridColumns : 1}
          columnWrapperStyle={isGrid ? styles.row : undefined}
          contentContainerStyle={[
            isGrid ? styles.content : styles.rowsContent,
            { backgroundColor: colors.background },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          renderItem={({ item }: { item: WithSpacer<RecentReleaseAlbum> }) => {
            if (item === SPACER) return <SpacerCell />;
            const onPress = () => {
              const mbid =
                item.artistMbid || item.foreignArtistId || item.artistId || "";
              pushArtist(mbid, item.artistName);
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
          ListEmptyComponent={
            <EmptyState icon="disc-outline" message="Nothing here yet" />
          }
        />
      </>
    );
  }

  if (kind === "recently-added") {
    const artists = recentlyAdded.data ?? [];
    return (
      <>
        {viewToolbar}
        <FlatList
          key={`${viewMode}-${gridColumns}`}
          data={isGrid ? padForGrid(artists, gridColumns) : artists}
          keyExtractor={(item, index) =>
            item === SPACER ? `spacer-${index}` : item.id
          }
          numColumns={isGrid ? gridColumns : 1}
          columnWrapperStyle={isGrid ? styles.row : undefined}
          contentContainerStyle={[
            isGrid ? styles.content : styles.rowsContent,
            { backgroundColor: colors.background },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          renderItem={({ item }: { item: WithSpacer<RecentlyAddedArtist> }) => {
            if (item === SPACER) return <SpacerCell />;
            const mbid = item.mbid || item.foreignArtistId || item.id;
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
                  onPress={() => pushArtist(mbid, item.artistName)}
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
                onPress={() => pushArtist(mbid, item.artistName)}
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState icon="disc-outline" message="Nothing here yet" />
          }
        />
      </>
    );
  }

  const artists =
    (kind === "recommended"
      ? discovery.data?.recommendations
      : discovery.data?.globalTop) ?? [];

  return (
    <>
      {viewToolbar}
      <FlatList
        key={`${viewMode}-${gridColumns}`}
        data={isGrid ? padForGrid(artists, gridColumns) : artists}
        keyExtractor={(item, index) =>
          item === SPACER ? `spacer-${index}` : item.id
        }
        numColumns={isGrid ? gridColumns : 1}
        columnWrapperStyle={isGrid ? styles.row : undefined}
        contentContainerStyle={[
          isGrid ? styles.content : styles.rowsContent,
          { backgroundColor: colors.background },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item }: { item: WithSpacer<DiscoveryArtist> }) => {
          if (item === SPACER) return <SpacerCell />;
          const subtitle = item.sourceArtist
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
                onPress={() => pushArtist(item.id, item.name)}
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
              onPress={() => pushArtist(item.id, item.name)}
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState icon="disc-outline" message="Nothing here yet" />
        }
      />
    </>
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
