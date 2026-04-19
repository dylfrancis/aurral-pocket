import { useCallback, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import {
  useDiscovery,
  useRecentlyAdded,
  useRecentReleases,
  useNearbyShows,
} from "@/hooks/discover";
import {
  RecentlyAddedSection,
  RecommendedForYouSection,
  GlobalTrendingSection,
  GenreSectionsPanel,
  ExploreByTagSection,
  RecentReleasesSection,
  ShowsNearYouSection,
} from "@/components/discover";
import type {
  ConcertEvent,
  DiscoveryArtist,
  RecentlyAddedArtist,
  RecentReleaseAlbum,
} from "@/lib/types/search";

export default function DiscoverScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();

  const { data: discovery, refetch: refetchDiscovery } = useDiscovery();
  const { refetch: refetchRecentlyAdded } = useRecentlyAdded();
  const { refetch: refetchRecentReleases } = useRecentReleases();
  const { refetch: refetchNearbyShows } = useNearbyShows();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchDiscovery(),
        refetchRecentlyAdded(),
        refetchRecentReleases(),
        refetchNearbyShows(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    refetchDiscovery,
    refetchRecentlyAdded,
    refetchRecentReleases,
    refetchNearbyShows,
  ]);

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

  const handleRecentlyAddedPress = useCallback(
    (artist: RecentlyAddedArtist) => {
      const mbid = artist.mbid || artist.foreignArtistId || artist.id;
      pushArtist(mbid, artist.artistName);
    },
    [pushArtist],
  );

  const handleDiscoveryArtistPress = useCallback(
    (artist: DiscoveryArtist) => {
      pushArtist(artist.id, artist.name);
    },
    [pushArtist],
  );

  const handleGenreArtistPress = useCallback(
    (artist: DiscoveryArtist) => {
      pushArtist(artist.id, artist.name);
    },
    [pushArtist],
  );

  const handleTagPress = useCallback(
    (tag: string) => {
      router.push({
        pathname: "/(app)/(tabs)/(search)/results",
        params: { q: `#${tag}` },
      });
    },
    [router],
  );

  const handleAlbumPress = useCallback(
    (album: RecentReleaseAlbum) => {
      const mbid =
        album.artistMbid || album.foreignArtistId || album.artistId || "";
      pushArtist(mbid, album.artistName);
    },
    [pushArtist],
  );

  const handleShowPress = useCallback((show: ConcertEvent) => {
    if (show.url) Linking.openURL(show.url).catch(() => {});
  }, []);

  const handleOpenSettings = useCallback(() => {
    router.push("/(app)/(tabs)/(settings)");
  }, [router]);

  const notConfigured =
    discovery?.configured === false &&
    (discovery.recommendations?.length ?? 0) === 0 &&
    (discovery.globalTop?.length ?? 0) === 0 &&
    (discovery.topGenres?.length ?? 0) === 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.subtle}
        />
      }
    >
      {notConfigured ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: colors.card, borderColor: colors.separator },
          ]}
        >
          <Ionicons name="sparkles-outline" size={32} color={colors.subtle} />
          <Text
            variant="body"
            style={[
              styles.emptyTitle,
              { color: colors.text, fontFamily: Fonts.semiBold },
            ]}
          >
            Discovery not configured
          </Text>
          <Text
            variant="caption"
            style={[styles.emptyBody, { color: colors.subtle }]}
          >
            Add artists to your library or configure Last.fm in Settings to see
            personalized recommendations.
          </Text>
          <Pressable
            onPress={handleOpenSettings}
            style={[styles.emptyButton, { backgroundColor: colors.brand }]}
          >
            <Text
              variant="caption"
              style={{ color: colors.background, fontFamily: Fonts.semiBold }}
            >
              Open Settings
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <RecentlyAddedSection onArtistPress={handleRecentlyAddedPress} />
          <ShowsNearYouSection
            onShowPress={handleShowPress}
            onOpenSettings={handleOpenSettings}
          />
          <RecentReleasesSection onAlbumPress={handleAlbumPress} />
          <RecommendedForYouSection
            onArtistPress={handleDiscoveryArtistPress}
          />
          <GlobalTrendingSection onArtistPress={handleDiscoveryArtistPress} />
          <GenreSectionsPanel onArtistPress={handleGenreArtistPress} />
          <ExploreByTagSection onTagPress={handleTagPress} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 32,
    gap: 20,
  },
  emptyCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    alignItems: "flex-start",
  },
  emptyTitle: {
    fontSize: 16,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
