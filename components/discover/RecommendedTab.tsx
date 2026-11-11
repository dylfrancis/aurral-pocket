import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { EmptyState } from "@/components/library/EmptyState";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useRecommendations } from "@/hooks/discover/use-recommendations";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import {
  buildRecommendedRails,
  firstGenre,
  recommendationReason,
  recommendedRailTitle,
  recommendedGenres,
  type RecommendedFilter,
} from "@/lib/discover/recommended";
import type { DiscoveryArtist } from "@/lib/types/search";
import { RecommendedRail } from "./RecommendedRail";
import { RecommendedTopPick } from "./RecommendedTopPick";

const RAILS_ON_SCREEN = 2;

type Props = {
  onArtistPress: (artist: DiscoveryArtist) => void;
  onShowList: (filter: RecommendedFilter) => void;
};

type Rail = {
  filter: RecommendedFilter;
  artists: DiscoveryArtist[];
  /** A seed rail's title already names the seed, so its cards give a genre. */
  cardsShowGenre?: boolean;
};

const railKey = ({ filter }: Rail) =>
  filter.kind === "genre" || filter.kind === "seed"
    ? `${filter.kind}:${filter.value}`
    : filter.kind;

/** Not a FlatList: it sits inside Discover's scroll view. */
export function RecommendedTab({ onArtistPress, onShowList }: Props) {
  const colors = Colors[useColorScheme()];
  const { isLoading, isError, refetch, recommendations, topGenres, context } =
    useRecommendations();
  const { seeds } = context;

  // Every recommendation, as the For You sections pass it, so they share a
  // lookup.
  const ids = useMemo(
    () => recommendations.map((artist) => artist.id),
    [recommendations],
  );
  const { isInLibrary } = useLibraryLookup(ids);

  const groups = useMemo(
    () => buildRecommendedRails(recommendations, context),
    [recommendations, context],
  );
  const rails = useMemo<Rail[]>(
    () =>
      [
        { filter: { kind: "new" } as const, artists: groups.fresh },
        ...groups.seedRails.map(({ seed, artists }) => ({
          filter: { kind: "seed", value: seed } as const,
          artists,
          cardsShowGenre: true,
        })),
        { filter: { kind: "close" } as const, artists: groups.closeToHome },
        { filter: { kind: "further" } as const, artists: groups.furtherOut },
        ...recommendedGenres(recommendations, topGenres, context).map(
          ({ genre, artists }) => ({
            filter: { kind: "genre", value: genre } as const,
            artists,
          }),
        ),
      ].filter((rail) => rail.artists.length > 0),
    [groups, recommendations, topGenres, context],
  );

  // Building every rail's covers at once stalls the UI thread, so the rails
  // below the fold follow one per frame.
  const [builtCount, setBuiltCount] = useState(RAILS_ON_SCREEN);
  useEffect(() => {
    if (builtCount >= rails.length) return;
    const frame = requestAnimationFrame(() =>
      setBuiltCount((count) => count + 1),
    );
    return () => cancelAnimationFrame(frame);
  }, [builtCount, rails.length]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <AlbumCategorySkeleton />
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={styles.message}>
        {isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            message="Recommendations didn't load"
            actionLabel="Try Again"
            onAction={() => void refetch()}
          />
        ) : (
          <EmptyState
            icon="sparkles-outline"
            message="No recommendations yet. Add artists you like to your library."
          />
        )}
      </View>
    );
  }

  const { topPick } = groups;
  const reasonFor = (artist: DiscoveryArtist) =>
    recommendationReason(artist, seeds);
  const count = recommendations.length;

  return (
    <View style={styles.tab}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`See all ${count} recommendations`}
        onPress={() => onShowList({ kind: "all" })}
        style={({ pressed }) => [styles.seeAll, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text variant="caption" style={{ color: colors.subtle }}>
          {count} {count === 1 ? "recommendation" : "recommendations"}
        </Text>
        <View style={styles.seeAllLink}>
          <Text
            variant="caption"
            style={[styles.seeAllLabel, { color: colors.brand }]}
          >
            See All
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.brand} />
        </View>
      </Pressable>
      {topPick ? (
        <RecommendedTopPick
          artist={topPick}
          seeds={seeds}
          onPress={() => onArtistPress(topPick)}
        />
      ) : null}
      {rails.slice(0, builtCount).map((rail) => (
        <RecommendedRail
          key={railKey(rail)}
          title={recommendedRailTitle(rail.filter)}
          artists={rail.artists}
          subtitle={rail.cardsShowGenre ? firstGenre : reasonFor}
          isInLibrary={isInLibrary}
          onArtistPress={onArtistPress}
          onViewAll={() => onShowList(rail.filter)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    gap: 12,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  seeAllLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllLabel: {
    ...Fonts.semiBold,
  },
  loading: {
    gap: 16,
  },
  message: {
    paddingTop: 48,
  },
});
