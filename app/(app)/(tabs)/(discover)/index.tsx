import {
  DiscoverHeaderSection,
  EditorialPlaylistsSection,
  GenreSectionsPanel,
  GlobalTrendingSection,
  MadeForYouSection,
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
import { useSheet } from "@/components/ui/AppSheet";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import Mic from "@expo/material-symbols/mic.xml";
import RadioIcon from "@expo/material-symbols/radio.xml";
import { Fonts } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import { useOpenSettings } from "@/hooks/use-open-settings";
import { useYourRadio } from "@/hooks/discover/use-your-radio";
import { useIsOffline } from "@/lib/offline/network";
import { SettingsToolbar } from "@/components/navigation/SettingsToolbar";
import {
  useDiscovery,
  useDiscoverLayout,
  useRecentlyAdded,
  useRecentReleases,
} from "@/hooks/discover";
import {
  recommendedFilterParams,
  type RecommendedFilter,
} from "@/lib/discover/recommended";
import { getEventUrl } from "@/lib/discover/nearby-shows";
import { recentReleaseRouteParams } from "@/lib/discover/releases";
import { discoverKeys } from "@/lib/query-keys";
import { artistRouteId } from "@/lib/library-read";
import type {
  ConcertEvent,
  DiscoveryArtist,
  RecentlyAddedArtist,
  RecentReleaseAlbum,
} from "@/lib/types/search";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { useColors } from "@/hooks/use-colors";

export default function DiscoverScreen() {
  const colors = useColors();
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
          queryKey: discoverKeys.editorialShelf("featured"),
        }),
        queryClient.invalidateQueries({
          queryKey: discoverKeys.madeForYou(),
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
    } else if (tab === "playlists") {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: discoverKeys.editorialShelf(),
        }),
        queryClient.invalidateQueries({
          queryKey: discoverKeys.madeForYou(),
        }),
      ]);
    } else {
      await queryClient.invalidateQueries({
        queryKey: discoverKeys.trending(),
      });
    }
  }, [queryClient, refetchDiscovery, refreshForYou, tab]);
  const { refreshing, onRefresh } = usePullToRefresh(refreshTab);

  const openArtist = useOpenArtist();

  const handleRecentlyAddedPress = useCallback(
    (artist: RecentlyAddedArtist) =>
      openArtist({ mbid: artistRouteId(artist), name: artist.artistName }),
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
      router.push({
        pathname: "/release/[mbid]",
        params: recentReleaseRouteParams(album),
      });
    },
    [router],
  );

  const handleShowPress = useCallback((show: ConcertEvent) => {
    const url = getEventUrl(show.url);
    if (url) Linking.openURL(url).catch(() => {});
  }, []);

  const handleOpenSettings = useOpenSettings();

  const shazamSheet = useSheet();

  const isOffline = useIsOffline();
  const { start: startYourRadio, isStarting: yourRadioStarting } =
    useYourRadio();
  const playYourRadio = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void startYourRadio();
  }, [startYourRadio]);

  const pushDiscoverList = useCallback(
    (kind: "trending" | "recently-added") => {
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
  const handleViewAllRecentReleases = useCallback(() => {
    router.push("/(app)/(tabs)/(discover)/releases");
  }, [router]);
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
      <SettingsToolbar />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={IS_IOS ? "radio" : RadioIcon}
          accessibilityLabel="Your Radio"
          disabled={isOffline || yourRadioStarting}
          onPress={playYourRadio}
        >
          Your Radio
        </Stack.Toolbar.Button>
        {isShazamAvailable && (
          <Stack.Toolbar.Button
            icon={IS_IOS ? "mic" : Mic}
            accessibilityLabel="Identify song"
            onPress={shazamSheet.present}
          >
            Identify song
          </Stack.Toolbar.Button>
        )}
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
                        case "madeForYou":
                          return (
                            <MadeForYouSection
                              key={section.id}
                              onViewAll={handleViewAllPlaylists}
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
                              feedStyle={section.style}
                              onShowPress={handleShowPress}
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
        sheet={shazamSheet}
        onViewArtist={(mbid, name) => openArtist({ mbid, name })}
        onViewRelease={(params) =>
          router.push({ pathname: "/release/[mbid]", params })
        }
        onSearchManually={(q) =>
          router.push({
            pathname: "/results",
            params: { q, filter: "artists" },
          })
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
