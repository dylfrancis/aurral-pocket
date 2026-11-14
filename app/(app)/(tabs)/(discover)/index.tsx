import {
  DiscoverHeaderSection,
  EditorialPlaylistsSection,
  GenreSectionsPanel,
  GlobalTrendingSection,
  RecentlyAddedSection,
  RecentReleasesSection,
  RecommendedForYouSection,
  ShowsNearYouSection,
} from "@/components/discover";
import { DiscoverTabPanel } from "@/components/discover/DiscoverTabPanel";
import { RecommendedTab } from "@/components/discover/RecommendedTab";
import { DiscoverTabs } from "@/components/discover/DiscoverTabs";
import type { DiscoverTab } from "@/components/discover/discover-tabs";
import { EditorialShelf } from "@/components/discover/EditorialShelf";
import { TrendingCharts } from "@/components/discover/TrendingCharts";
import { ShazamSheet } from "@/components/shazam";
import { isShazamAvailable } from "@/modules/shazam";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import Mic from "@expo/material-symbols/mic.xml";
import { Colors, Fonts } from "@/constants/theme";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";
import { OverflowMenu } from "@/components/navigation/OverflowMenu";
import { useOpenOverflowScreen } from "@/hooks/use-open-overflow-screen";
import {
  useDiscovery,
  useDiscoverLayout,
  useRecentlyAdded,
  useRecentReleases,
} from "@/hooks/discover";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  recommendedFilterParams,
  type RecommendedFilter,
} from "@/lib/discover/recommended";
import { discoverKeys } from "@/lib/query-keys";
import type {
  ConcertEvent,
  DiscoveryArtist,
  RecentlyAddedArtist,
  RecentReleaseAlbum,
} from "@/lib/types/search";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
} from "react-native";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useOpenArtist } from "@/hooks/use-open-artist";

export default function DiscoverScreen() {
  const colors = Colors[useColorScheme()];
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: discovery, refetch: refetchDiscovery } = useDiscovery();
  const { refetch: refetchRecentlyAdded } = useRecentlyAdded();
  const { refetch: refetchRecentReleases } = useRecentReleases();
  const { sections, hydrated: layoutHydrated } = useDiscoverLayout();

  const [tab, setTab] = useState<DiscoverTab>("forYou");
  const [openedTabs, setOpenedTabs] = useState<ReadonlySet<DiscoverTab>>(
    () => new Set(["forYou"]),
  );
  const selectTab = useCallback((next: DiscoverTab) => {
    setOpenedTabs((opened) =>
      opened.has(next) ? opened : new Set(opened).add(next),
    );
    setTab(next);
  }, []);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // The header shrinks as the large title collapses; the page's top is where
  // the expanded title ends.
  const headerHeight = useHeaderHeight();
  const expandedHeaderHeight = useRef(0);
  useEffect(() => {
    expandedHeaderHeight.current = Math.max(
      expandedHeaderHeight.current,
      headerHeight,
    );
  }, [headerHeight]);

  const refreshForYou = useCallback(
    () =>
      Promise.all([
        refetchDiscovery(),
        refetchRecentlyAdded(),
        refetchRecentReleases(),
        queryClient.invalidateQueries({
          queryKey: discoverKeys.nearbyShowsAll(),
        }),
        queryClient.invalidateQueries({
          queryKey: discoverKeys.editorialShelf(),
        }),
      ]),
    [
      queryClient,
      refetchDiscovery,
      refetchRecentlyAdded,
      refetchRecentReleases,
    ],
  );

  const refreshTab = useCallback(async () => {
    if (tab === "forYou") {
      await refreshForYou();
    } else if (tab === "recommended") {
      await refetchDiscovery();
    } else {
      await queryClient.invalidateQueries({
        queryKey:
          tab === "playlists"
            ? discoverKeys.editorialShelf()
            : discoverKeys.trending(),
      });
    }
  }, [queryClient, refetchDiscovery, refreshForYou, tab]);
  const { refreshing, onRefresh } = usePullToRefresh(refreshTab);

  const openArtist = useOpenArtist();

  const handleRecentlyAddedPress = useCallback(
    (artist: RecentlyAddedArtist) => {
      const mbid = artist.mbid || artist.foreignArtistId || artist.id;
      openArtist({ mbid, name: artist.artistName });
    },
    [openArtist],
  );

  const handleDiscoveryArtistPress = useCallback(
    (artist: DiscoveryArtist) => {
      openArtist({ mbid: artist.id, name: artist.name });
    },
    [openArtist],
  );

  const handleGenreArtistPress = useCallback(
    (artist: DiscoveryArtist) => {
      openArtist({ mbid: artist.id, name: artist.name });
    },
    [openArtist],
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
      openArtist({ mbid, name: album.artistName });
    },
    [openArtist],
  );

  const handleShowPress = useCallback((show: ConcertEvent) => {
    if (show.url) Linking.openURL(show.url).catch(() => {});
  }, []);

  const openOverflowScreen = useOpenOverflowScreen();
  const handleOpenSettings = useCallback(
    () => openOverflowScreen("settings"),
    [openOverflowScreen],
  );

  const shazamSheetRef = useRef<BottomSheetModal>(null);

  const pushDiscoverList = useCallback(
    (kind: "trending" | "recently-added" | "recent-releases") => {
      router.push({
        pathname: "/(app)/(tabs)/(discover)/list/[kind]",
        params: { kind },
      });
    },
    [router],
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
  // The tabs share one scroll view, so a tab opened from a View All would
  // open partway down.
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: IS_IOS ? -expandedHeaderHeight.current : 0,
      animated: false,
    });
  }, []);
  const handleViewAllPlaylists = useCallback(() => {
    selectTab("playlists");
    scrollToTop();
  }, [scrollToTop, selectTab]);
  const handleViewAllRecommended = useCallback(() => {
    selectTab("recommended");
    scrollToTop();
  }, [scrollToTop, selectTab]);
  const handleShowRecommendedList = useCallback(
    (filter: RecommendedFilter) => {
      router.push({
        pathname: "/(app)/(tabs)/(discover)/list/[kind]",
        params: { kind: "recommended", ...recommendedFilterParams(filter) },
      });
    },
    [router],
  );

  const notConfigured =
    discovery?.configured === false &&
    (discovery.recommendations?.length ?? 0) === 0 &&
    (discovery.globalTop?.length ?? 0) === 0 &&
    (discovery.topGenres?.length ?? 0) === 0;

  return (
    <>
      <Stack.Toolbar placement="right">
        {isShazamAvailable && (
          <Stack.Toolbar.Button
            icon={IS_IOS ? "mic" : Mic}
            accessibilityLabel="Identify song"
            onPress={() => shazamSheetRef.current?.present()}
          >
            Identify song
          </Stack.Toolbar.Button>
        )}
        {IS_ANDROID && <OverflowMenu />}
      </Stack.Toolbar>
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        // View All scrolls to a negative offset, where the expanded large
        // title rests on iOS.
        scrollToOverflowEnabled
        keyboardDismissMode="on-drag"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.subtle}
          />
        }
      >
        <DiscoverTabs selected={tab} onSelect={selectTab} />
        <DiscoverTabPanel active={tab === "forYou"}>
          {notConfigured ? (
            <Card bordered style={styles.emptyCard}>
              <Ionicons
                name="sparkles-outline"
                size={32}
                color={colors.subtle}
              />
              <Text
                variant="body"
                style={[
                  styles.emptyTitle,
                  { color: colors.text, ...Fonts.semiBold },
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
                  style={{
                    color: colors.buttonPrimaryText,
                    ...Fonts.semiBold,
                  }}
                >
                  Open Settings
                </Text>
              </Pressable>
            </Card>
          ) : (
            <>
              <DiscoverHeaderSection onTagPress={handleTagPress} />
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
                        case "playlists":
                          return (
                            <EditorialPlaylistsSection
                              key={section.id}
                              onViewAll={handleViewAllPlaylists}
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
                        default:
                          return null;
                      }
                    })
                : null}
            </>
          )}
        </DiscoverTabPanel>
        {openedTabs.has("recommended") ? (
          <DiscoverTabPanel active={tab === "recommended"}>
            <RecommendedTab
              onArtistPress={handleDiscoveryArtistPress}
              onShowList={handleShowRecommendedList}
            />
          </DiscoverTabPanel>
        ) : null}
        {openedTabs.has("playlists") ? (
          <DiscoverTabPanel active={tab === "playlists"}>
            <EditorialShelf />
          </DiscoverTabPanel>
        ) : null}
        {openedTabs.has("trending") ? (
          <DiscoverTabPanel active={tab === "trending"}>
            <TrendingCharts active={tab === "trending"} />
          </DiscoverTabPanel>
        ) : null}
      </ScrollView>
      <ShazamSheet
        sheetRef={shazamSheetRef}
        onViewArtist={(mbid, name) => openArtist({ mbid, name })}
        onSearchManually={(q) =>
          router.push({ pathname: "/results", params: { q, scope: "artist" } })
        }
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

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load Discover" />;
}
