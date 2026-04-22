import { useCallback, useEffect, useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import {
  useDiscovery,
  useRecentlyAdded,
  useRecentReleases,
} from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { HorizontalArtistCard } from "@/components/discover/HorizontalArtistCard";
import { DiscoverReleaseCard } from "@/components/discover/DiscoverReleaseCard";
import { EmptyState } from "@/components/library/EmptyState";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import type {
  DiscoveryArtist,
  RecentlyAddedArtist,
  RecentReleaseAlbum,
} from "@/lib/types/search";

type Kind = "recommended" | "trending" | "recently-added" | "recent-releases";

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
  return `Added ${d.toLocaleDateString()}`;
}

const SPACER = "__spacer__" as const;
type WithSpacer<T> = T | typeof SPACER;

function padForGrid<T>(items: T[]): WithSpacer<T>[] {
  return items.length % 2 === 1 ? [...items, SPACER] : items;
}

function SpacerCell() {
  return <View style={styles.spacer} />;
}

export default function DiscoverListScreen() {
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const colors = Colors[useColorScheme()];
  const { isInLibrary } = useLibraryLookup();

  const kind: Kind | null = isValidKind(kindParam) ? kindParam : null;

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
        <AlbumCategorySkeleton />
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (kind === "recent-releases") {
    const albums = recentReleases.data ?? [];
    return (
      <FlatList
        data={padForGrid(albums)}
        keyExtractor={(item, index) =>
          item === SPACER
            ? `spacer-${index}`
            : item.id ||
              item.mbid ||
              item.foreignAlbumId ||
              `${item.albumName}-${index}`
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.background },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item }: { item: WithSpacer<RecentReleaseAlbum> }) =>
          item === SPACER ? (
            <SpacerCell />
          ) : (
            <DiscoverReleaseCard
              album={item}
              fill
              onPress={() => {
                const mbid =
                  item.artistMbid ||
                  item.foreignArtistId ||
                  item.artistId ||
                  "";
                pushArtist(mbid, item.artistName);
              }}
            />
          )
        }
        ListEmptyComponent={
          <EmptyState icon="disc-outline" message="Nothing here yet" />
        }
      />
    );
  }

  if (kind === "recently-added") {
    const artists = recentlyAdded.data ?? [];
    return (
      <FlatList
        data={padForGrid(artists)}
        keyExtractor={(item, index) =>
          item === SPACER ? `spacer-${index}` : item.id
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.background },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item }: { item: WithSpacer<RecentlyAddedArtist> }) => {
          if (item === SPACER) return <SpacerCell />;
          const mbid = item.mbid || item.foreignArtistId || item.id;
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
    );
  }

  const artists =
    (kind === "recommended"
      ? discovery.data?.recommendations
      : discovery.data?.globalTop) ?? [];

  return (
    <FlatList
      data={padForGrid(artists)}
      keyExtractor={(item, index) =>
        item === SPACER ? `spacer-${index}` : item.id
      }
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[
        styles.content,
        { backgroundColor: colors.background },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      renderItem={({ item }: { item: WithSpacer<DiscoveryArtist> }) =>
        item === SPACER ? (
          <SpacerCell />
        ) : (
          <HorizontalArtistCard
            mbid={item.id}
            name={item.name}
            subtitle={
              item.sourceArtist ? `Similar to ${item.sourceArtist}` : undefined
            }
            isInLibrary={isInLibrary(item.id)}
            fill
            onPress={() => pushArtist(item.id, item.name)}
          />
        )
      }
      ListEmptyComponent={
        <EmptyState icon="disc-outline" message="Nothing here yet" />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
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
