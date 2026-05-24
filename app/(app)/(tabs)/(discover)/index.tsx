import {
  CustomizeDiscoverSheet,
  DiscoverHeaderSection,
  ExploreByTagSection,
  GenreSectionsPanel,
  GlobalTrendingSection,
  RecentlyAddedSection,
  RecentReleasesSection,
  RecommendedForYouSection,
  ShowsNearYouSection,
} from "@/components/discover";
import { SettingsSheet } from "@/components/settings/SettingsSheet";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import {
  useDiscovery,
  useDiscoverLayout,
  useRecentlyAdded,
  useRecentReleases,
} from "@/hooks/discover";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { discoverKeys } from "@/lib/query-keys";
import type { DiscoverSection } from "@/lib/types/me";
import type {
  ConcertEvent,
  DiscoveryArtist,
  RecentlyAddedArtist,
  RecentReleaseAlbum,
} from "@/lib/types/search";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

export default function DiscoverScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasPermission = useHasPermission();
  const canAccessSettings = hasPermission("accessSettings");

  const { data: discovery, refetch: refetchDiscovery } = useDiscovery();
  const { refetch: refetchRecentlyAdded } = useRecentlyAdded();
  const { refetch: refetchRecentReleases } = useRecentReleases();
  const {
    sections,
    hydrated: layoutHydrated,
    saveLayout,
  } = useDiscoverLayout();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const settingsSheetRef = useRef<BottomSheetModal>(null);
  const customizeSheetRef = useRef<BottomSheetModal>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchDiscovery(),
        refetchRecentlyAdded(),
        refetchRecentReleases(),
        queryClient.invalidateQueries({
          queryKey: discoverKeys.nearbyShowsAll(),
        }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    queryClient,
    refetchDiscovery,
    refetchRecentlyAdded,
    refetchRecentReleases,
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
        pathname: "/(app)/(tabs)/(discover)/tag-results",
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
    settingsSheetRef.current?.present();
  }, []);

  const handleOpenCustomize = useCallback(() => {
    customizeSheetRef.current?.present();
  }, []);

  const handleSaveLayout = useCallback(
    async (next: DiscoverSection[]) => {
      await saveLayout(next);
    },
    [saveLayout],
  );

  const handleSaveLayoutError = useCallback((err: unknown) => {
    const message =
      err instanceof Error && err.message ? err.message : "Please try again.";
    Alert.alert("Could not save layout", message);
  }, []);

  const pushDiscoverList = useCallback(
    (
      kind: "recommended" | "trending" | "recently-added" | "recent-releases",
    ) => {
      router.push({
        pathname: "/(app)/(tabs)/(discover)/list/[kind]",
        params: { kind },
      });
    },
    [router],
  );

  const handleViewAllRecommended = useCallback(
    () => pushDiscoverList("recommended"),
    [pushDiscoverList],
  );
  const handleViewAllTrending = useCallback(
    () => pushDiscoverList("trending"),
    [pushDiscoverList],
  );
  const handleViewAllRecentlyAdded = useCallback(
    () => pushDiscoverList("recently-added"),
    [pushDiscoverList],
  );
  const handleViewAllRecentReleases = useCallback(
    () => pushDiscoverList("recent-releases"),
    [pushDiscoverList],
  );
  const handleViewAllNearbyShows = useCallback(() => {
    router.push("/(app)/(tabs)/(discover)/nearby-shows");
  }, [router]);

  const notConfigured =
    discovery?.configured === false &&
    (discovery.recommendations?.length ?? 0) === 0 &&
    (discovery.globalTop?.length ?? 0) === 0 &&
    (discovery.topGenres?.length ?? 0) === 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: canAccessSettings
            ? () => (
                <Pressable
                  onPress={handleOpenSettings}
                  style={({ pressed }) => [
                    styles.headerButton,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                  accessibilityLabel="Settings"
                >
                  <Ionicons
                    name="settings-outline"
                    size={22}
                    color={colors.text}
                  />
                </Pressable>
              )
            : undefined,
        }}
      />
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
              Add artists to your library or configure Last.fm in Settings to
              see personalized recommendations.
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
            <DiscoverHeaderSection
              onTagPress={handleTagPress}
              onCustomize={handleOpenCustomize}
            />
            {layoutHydrated
              ? sections
                  .filter((section) => section.enabled)
                  .map((section) => {
                    switch (section.id) {
                      case "recentlyAdded":
                        return (
                          <RecentlyAddedSection
                            key={section.id}
                            onArtistPress={handleRecentlyAddedPress}
                            onViewAll={handleViewAllRecentlyAdded}
                          />
                        );
                      case "recommendedShows":
                        return (
                          <ShowsNearYouSection
                            key={section.id}
                            onShowPress={handleShowPress}
                            onOpenSettings={handleOpenSettings}
                            onViewAll={handleViewAllNearbyShows}
                          />
                        );
                      case "recentReleases":
                        return (
                          <RecentReleasesSection
                            key={section.id}
                            onAlbumPress={handleAlbumPress}
                            onViewAll={handleViewAllRecentReleases}
                          />
                        );
                      case "recommended":
                        return (
                          <RecommendedForYouSection
                            key={section.id}
                            onArtistPress={handleDiscoveryArtistPress}
                            onViewAll={handleViewAllRecommended}
                          />
                        );
                      case "globalTop":
                        return (
                          <GlobalTrendingSection
                            key={section.id}
                            onArtistPress={handleDiscoveryArtistPress}
                            onViewAll={handleViewAllTrending}
                          />
                        );
                      case "genreSections":
                        return (
                          <GenreSectionsPanel
                            key={section.id}
                            onArtistPress={handleGenreArtistPress}
                            onViewAllGenre={handleTagPress}
                          />
                        );
                      case "topTags":
                        return (
                          <ExploreByTagSection
                            key={section.id}
                            onTagPress={handleTagPress}
                          />
                        );
                      default:
                        return null;
                    }
                  })
              : null}
          </>
        )}
      </ScrollView>
      <SettingsSheet sheetRef={settingsSheetRef} />
      <CustomizeDiscoverSheet
        sheetRef={customizeSheetRef}
        sections={sections}
        onSave={handleSaveLayout}
        onSaveError={handleSaveLayoutError}
      />
    </>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 32,
    gap: 12,
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
  headerButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
