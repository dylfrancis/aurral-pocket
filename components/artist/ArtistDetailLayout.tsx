import { ArtistBioSection } from "@/components/artist/ArtistBioSection";
import {
  AddToPlaylistSheet,
  useAddToPlaylist,
} from "@/components/flow/AddToPlaylistSheet";
import { LibraryAlbumsSection } from "@/components/artist/LibraryAlbumsSection";
import { ReleaseGroupsSection } from "@/components/artist/ReleaseGroupsSection";
import { SimilarArtistsSection } from "@/components/artist/SimilarArtistsSection";
import { TopTracksSection } from "@/components/artist/TopTracksSection";
import { ArtistHero } from "@/components/library/ArtistHero";
import { ArtistTags } from "@/components/library/ArtistTags";
import { AddArtistSheet } from "@/components/search/AddArtistSheet";
import { Fonts } from "@/constants/theme";
import { HAS_LIQUID_GLASS } from "@/constants/navigation";
import { IS_IOS } from "@/constants/platform";
import { useAlbumsWithTypes } from "@/hooks/library/use-albums-with-types";
import { useArtistDetailsStream } from "@/hooks/library/use-artist-details-stream";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import {
  albumDownloadStatus,
  albumRouteParams,
  libraryAlbumsRef,
  releaseRouteParams,
} from "@/lib/library-read";
import {
  useCanonicalArtist,
  useLibraryArtist,
} from "@/hooks/library/use-library-artist";
import { useToggleFavorite } from "@/hooks/library/use-library-favorites";
import { usePreviewPlayer } from "@/hooks/library/use-preview-player";
import { useResearchMissingAlbums } from "@/hooks/library/use-research-missing-albums";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useLidarrConfigured } from "@/hooks/auth/use-lidarr-configured";
import {
  useBlocklist,
  useBlocklistMutations,
} from "@/hooks/discover/use-blocklist";
import { findBlockedArtist } from "@/lib/blocklist";
import {
  setArtistInLibrary,
  useLibraryLookup,
} from "@/hooks/search/use-library-lookup";
import { useSimilarArtists } from "@/hooks/search/use-similar-artists";
import { deleteLibraryArtist, refreshLibraryArtist } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import { groupReleasesBySection, librarySection } from "@/lib/release-groups";
import type {
  Album,
  PreviewTrack,
  PrimaryReleaseType,
  ReleaseGroup,
} from "@/lib/types/library";
import type { SimilarArtist } from "@/lib/types/search";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import Sync from "@expo/material-symbols/sync.xml";
import SearchIcon from "@expo/material-symbols/search.xml";
import BlockIcon from "@expo/material-symbols/block.xml";
import CheckCircle from "@expo/material-symbols/check_circle.xml";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useColors } from "@/hooks/use-colors";

function sortByDate(albums: Album[]): Album[] {
  return albums.slice().sort((a, b) => {
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return (
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );
  });
}

type ArtistDetailLayoutProps = {
  mbid: string;
  artistName: string;
  /** The cover the row that opened the page already has. */
  coverUrl?: string;
  onNavigateToReleases: (type: PrimaryReleaseType, label: string) => void;
  onNavigateToAlbums?: (type: PrimaryReleaseType, label: string) => void;
  onSimilarArtistPress: (artist: SimilarArtist) => void;
};

export function ArtistDetailLayout({
  mbid,
  artistName,
  coverUrl,
  onNavigateToReleases,
  onNavigateToAlbums,
  onSimilarArtistPress,
}: ArtistDetailLayoutProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { isInLibrary, isLoading: libraryStatusLoading } = useLibraryLookup([
    mbid,
  ]);
  const inLibrary = isInLibrary(mbid);
  const { data: libraryArtist, refetch: refetchArtist } = useLibraryArtist(
    inLibrary ? mbid : undefined,
  );
  const {
    data: canonicalArtist,
    isPending: canonicalArtistLoading,
    refetch: refetchCanonicalArtist,
  } = useCanonicalArtist(inLibrary ? mbid : undefined);
  const toggleFavorite = useToggleFavorite();
  // Shows the tap at once. A refused toggle falls back to the artist's own flag.
  const isFavorite = toggleFavorite.isPending
    ? toggleFavorite.variables.starred
    : canonicalArtist?.userFavorite === true;
  const handleToggleFavorite = () => {
    if (!canonicalArtist?.identityKey || toggleFavorite.isPending) return;
    toggleFavorite.mutate({
      kind: "artist",
      key: canonicalArtist.identityKey,
      starred: !isFavorite,
    });
  };
  // The read path decides whether albums are addressed by Lidarr id or by
  // MBID, so both identifiers go in and the helper picks one.
  const albumsRef = libraryAlbumsRef({
    artistId: libraryArtist?.id,
    artistMbid: inLibrary ? mbid : undefined,
  });
  const {
    data: rawAlbums,
    isLoading: albumsLoading,
    error: albumsError,
    refetch: refetchAlbums,
  } = useLibraryAlbums(albumsRef);
  const { stop: stopPreview, ...preview } = usePreviewPlayer(mbid, artistName);
  const { data: details } = useArtistDetailsStream(mbid);
  const { data: similarArtists } = useSimilarArtists(mbid);

  const allReleaseGroups = details?.releaseGroups;

  const { albums: typedAlbums, isLoadingTypes } = useAlbumsWithTypes(
    inLibrary ? mbid : undefined,
    rawAlbums,
    { releaseGroups: allReleaseGroups },
  );
  const { data: downloadStatuses } = useDownloadStatuses(rawAlbums);

  const hasPermission = useHasPermission();
  const canResearchMissing = hasPermission("addAlbum");
  const { missingCount, researchMissing, isResearching } =
    useResearchMissingAlbums(rawAlbums, downloadStatuses, {
      mbid,
      name: libraryArtist?.artistName || artistName,
    });
  // The server's refresh only asks Lidarr to search the artist.
  const lidarrConfigured = useLidarrConfigured();
  const canRefresh =
    inLibrary &&
    lidarrConfigured &&
    !!libraryArtist &&
    libraryArtist.managedBy !== "aurral";

  const pollCount = useRef(0);
  useEffect(() => {
    if (!inLibrary) return;
    const hasRealId = libraryArtist?.id && libraryArtist.id !== "";
    const hasAlbums = rawAlbums && rawAlbums.length > 0;
    if (hasRealId && hasAlbums) {
      pollCount.current = 0;
      return;
    }
    if (pollCount.current >= 12) return;
    const interval = setInterval(() => {
      pollCount.current += 1;
      if (pollCount.current >= 12) {
        clearInterval(interval);
        return;
      }
      if (!hasRealId) {
        void refetchArtist();
      } else {
        void refetchAlbums();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [inLibrary, libraryArtist?.id, rawAlbums, refetchArtist, refetchAlbums]);

  // An artist added from this page reads as null until its first album is
  // indexed, and nothing else would read it again.
  const albumsIndexed = !!rawAlbums?.length;
  useEffect(() => {
    if (albumsIndexed && canonicalArtist === null) {
      void refetchCanonicalArtist();
    }
  }, [albumsIndexed, canonicalArtist, refetchCanonicalArtist]);

  const libraryAlbumMbids = useMemo(() => {
    if (!rawAlbums) return new Set<string>();
    const set = new Set<string>();
    for (const a of rawAlbums) {
      set.add(a.mbid);
      set.add(a.foreignAlbumId);
    }
    return set;
  }, [rawAlbums]);

  const groupedReleases = useMemo(() => {
    if (!allReleaseGroups) return null;
    return groupReleasesBySection(
      allReleaseGroups.filter((rg) => !libraryAlbumMbids.has(rg.id)),
    );
  }, [allReleaseGroups, libraryAlbumMbids]);

  const groupedLibraryAlbums = useMemo(() => {
    if (!typedAlbums) return null;
    const map = new Map<PrimaryReleaseType, Album[]>();
    for (const album of typedAlbums) {
      const type = librarySection(album);
      const list = map.get(type) ?? [];
      list.push(album);
      map.set(type, list);
    }
    for (const [key, list] of map) {
      map.set(key, sortByDate(list));
    }
    return map;
  }, [typedAlbums]);

  const { canAddToPlaylist, ...addToPlaylist } = useAddToPlaylist();

  const openAddToPlaylist = addToPlaylist.open;
  const handleAddToPlaylist = useCallback(
    (track: PreviewTrack) => {
      openAddToPlaylist({
        artistName,
        trackName: track.title,
        albumName: track.album,
        artistMbid: mbid,
      });
    },
    [openAddToPlaylist, artistName, mbid],
  );

  const addArtistSheetRef = useRef<BottomSheetModal>(null);

  const openReleaseGroup = useCallback(
    (rg: ReleaseGroup) => {
      stopPreview();
      router.push({
        pathname: "/release/[mbid]",
        params: releaseRouteParams({
          mbid: rg.id,
          title: rg.title,
          artistName,
          artistMbid: mbid,
          artistId: libraryArtist?.id,
          primaryType: rg["primary-type"],
          secondaryTypes: rg["secondary-types"],
          releaseDate: rg["first-release-date"],
        }),
      });
    },
    [stopPreview, router, artistName, mbid, libraryArtist?.id],
  );

  // A bare path, so expo-router resolves it inside whichever tab group is
  // showing this artist.
  const openAlbum = useCallback(
    (album: Album) => {
      router.push({
        pathname: "/album/[ref]",
        params: albumRouteParams(
          album,
          artistName,
          mbid,
          albumDownloadStatus(downloadStatuses, album),
        ),
      });
    },
    [router, artistName, mbid, downloadStatuses],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLibraryArtist(id),
    onSuccess: () => {
      setArtistInLibrary(queryClient, mbid, false);
      void queryClient.invalidateQueries({ queryKey: libraryKeys.artists() });
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.albumsAllViews(),
      });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.genres() });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshLibraryArtist(mbid),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.artist(mbid),
      });
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.canonicalArtist(mbid),
      });
      if (libraryArtist) {
        void queryClient.invalidateQueries({
          queryKey: libraryKeys.albums(
            libraryAlbumsRef({ artistId: libraryArtist.id, artistMbid: mbid })!,
          ),
        });
      }
    },
  });

  const handleBadgePress = useCallback(() => {
    if (!libraryArtist) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Remove from Library",
      `Remove "${libraryArtist.artistName}" and all their albums from your library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteMutation.mutate(libraryArtist.mbid),
        },
      ],
    );
  }, [libraryArtist, deleteMutation]);

  // Blocking is the `block_artist` slice of /discover/feedback, the same call
  // the blocklist screen makes — only the source context differs.
  const { data: blockedArtists } = useBlocklist();
  const { blockArtist, unblockArtist } = useBlocklistMutations();
  const blockedEntry = useMemo(
    () => findBlockedArtist(blockedArtists, { id: mbid, name: artistName }),
    [blockedArtists, mbid, artistName],
  );

  const handleToggleBlock = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (blockedEntry) {
      unblockArtist.mutate(blockedEntry, {
        onSuccess: () =>
          Burnt.toast({ title: `Unblocked ${artistName}`, preset: "done" }),
        onError: () =>
          Burnt.toast({ title: "Couldn't unblock artist", preset: "error" }),
      });
      return;
    }
    blockArtist.mutate(
      { id: mbid, name: artistName, sourceContext: "artist_detail" },
      {
        onSuccess: () =>
          Burnt.toast({ title: `Blocked ${artistName}`, preset: "done" }),
        onError: () =>
          Burnt.toast({ title: "Couldn't block artist", preset: "error" }),
      },
    );
  }, [blockedEntry, unblockArtist, blockArtist, mbid, artistName]);

  const refreshArtist = useCallback(
    () => Promise.all([refetchAlbums(), refetchCanonicalArtist()]),
    [refetchAlbums, refetchCanonicalArtist],
  );
  const { refreshing, onRefresh } = usePullToRefresh(refreshArtist);

  const handleSimilarPress = useCallback(
    (artist: SimilarArtist) => {
      stopPreview();
      onSimilarArtistPress(artist);
    },
    [stopPreview, onSimilarArtistPress],
  );

  // With Liquid Glass the scroll view insets below the header, as the album
  // page does, and the hero bleeds back up under it. iOS then sees the page at
  // its top edge and leaves the photo unblurred until it scrolls. The offset
  // starts at minus the header's height, so the scroll position adds it back.
  const headerHeight = useHeaderHeight();
  const heroBleed = HAS_LIQUID_GLASS ? headerHeight : 0;
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y + heroBleed;
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollHeaderTitle name={artistName} scrollY={scrollY} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={IS_IOS ? "ellipsis" : MoreVert}
          accessibilityLabel="More actions"
        >
          {canRefresh && (
            <Stack.Toolbar.MenuAction
              icon={IS_IOS ? "arrow.clockwise" : Sync}
              disabled={refreshMutation.isPending}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                refreshMutation.mutate();
              }}
            >
              {refreshMutation.isPending ? "Refreshing…" : "Refresh"}
            </Stack.Toolbar.MenuAction>
          )}
          {inLibrary && canResearchMissing && (
            <Stack.Toolbar.MenuAction
              icon={IS_IOS ? "magnifyingglass" : SearchIcon}
              hidden={missingCount === 0}
              disabled={isResearching}
              onPress={() => researchMissing()}
            >
              {`Re-search Missing (${missingCount})`}
            </Stack.Toolbar.MenuAction>
          )}
          <Stack.Toolbar.MenuAction
            icon={
              IS_IOS
                ? blockedEntry
                  ? "checkmark.circle"
                  : "nosign"
                : blockedEntry
                  ? CheckCircle
                  : BlockIcon
            }
            // Native menus only offer the platform destructive style, so red
            // here is the system red rather than the theme's error token.
            destructive={!blockedEntry}
            disabled={blockArtist.isPending || unblockArtist.isPending}
            onPress={handleToggleBlock}
          >
            {blockedEntry ? "Unblock Artist" : "Block Artist"}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <Animated.ScrollView
        contentInsetAdjustmentBehavior={
          HAS_LIQUID_GLASS ? "automatic" : undefined
        }
        contentContainerStyle={{
          // The automatic inset already clears the tab bar.
          paddingBottom: (HAS_LIQUID_GLASS ? 0 : insets.bottom) + 16,
        }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          inLibrary ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="transparent"
            />
          ) : undefined
        }
      >
        <View style={{ marginTop: -heroBleed }}>
          <ArtistHero
            // The live record wins over the row that opened the page, which may
            // carry a cover version from before the artwork changed.
            artist={{
              mbid,
              artistName,
              coverUrl: canonicalArtist?.coverUrl || coverUrl,
            }}
            scrollY={scrollY}
            refreshing={refreshing}
            inLibrary={libraryStatusLoading ? undefined : inLibrary}
            onBadgePress={handleBadgePress}
            // Shows while the artist loads, so the heart doesn't pop in and shift
            // the badge.
            favorite={
              canonicalArtistLoading || canonicalArtist?.identityKey
                ? { active: isFavorite, onToggle: handleToggleFavorite }
                : undefined
            }
            onAddPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              addArtistSheetRef.current?.present();
            }}
          />
        </View>

        <ArtistTags mbid={mbid} />

        <TopTracksSection
          tracks={preview.tracks ?? []}
          isLoading={preview.isLoading}
          playingId={preview.playingId}
          loadingId={preview.loadingId}
          progress={preview.progress}
          onToggle={preview.toggle}
          onAddToPlaylist={canAddToPlaylist ? handleAddToPlaylist : undefined}
        />

        {inLibrary && (
          <LibraryAlbumsSection
            grouped={groupedLibraryAlbums}
            isLoading={albumsLoading || isLoadingTypes}
            error={albumsError}
            downloadStatuses={downloadStatuses}
            onAlbumPress={openAlbum}
            onNavigate={onNavigateToAlbums}
            onRetry={() => refetchAlbums()}
          />
        )}

        <ReleaseGroupsSection
          grouped={groupedReleases}
          isLoading={
            !inLibrary &&
            !details?.isComplete &&
            (!allReleaseGroups || allReleaseGroups.length === 0)
          }
          onPress={openReleaseGroup}
          onNavigate={onNavigateToReleases}
        />

        <SimilarArtistsSection
          artists={similarArtists ?? []}
          onPress={handleSimilarPress}
        />

        <ArtistBioSection
          bio={details?.bio}
          artistName={artistName}
          mbid={mbid}
        />
      </Animated.ScrollView>

      {!inLibrary && (
        <AddArtistSheet
          mbid={mbid}
          artistName={artistName}
          sheetRef={addArtistSheetRef}
          onAdded={() => {
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          }}
        />
      )}

      <AddToPlaylistSheet
        track={addToPlaylist.track}
        onClose={addToPlaylist.close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 17,
    ...Fonts.semiBold,
  },
});

type ScrollHeaderTitleProps = {
  name: string;
  scrollY: SharedValue<number>;
};

/**
 * Puts the page name in the nav bar once the hero name has scrolled under
 * it. Shared with the album, release and playlist pages, which use the same
 * hero-then-title layout. It sets the screen's header title and draws
 * nothing in the page itself.
 */
export function ScrollHeaderTitle({ name, scrollY }: ScrollHeaderTitleProps) {
  if (HAS_LIQUID_GLASS) {
    return <NativeScrollHeaderTitle name={name} scrollY={scrollY} />;
  }
  return (
    <Stack.Screen
      options={{
        headerTitle: () => <FadingHeaderTitle name={name} scrollY={scrollY} />,
      }}
    />
  );
}

/** The scroll offsets over which the header title comes in. */
function headerTitleRange() {
  const screenWidth = Dimensions.get("window").width;
  // Hero artist name sits at roughly screenWidth - 92px from top of scrollview.
  // Account for nav bar (~94px) so we trigger when it scrolls under the bar,
  // with extra vertical buffer so the hero title is clearly gone first.
  return { start: screenWidth - 140, end: screenWidth - 60 };
}

/**
 * Liquid Glass blurs the content under the bar only while the title is the
 * bar's own text. A custom title view leaves the rows sharp, and an empty
 * title drops the blur altogether. So the title is always the name, kept
 * transparent until the hero name has gone. It shows in one step: a fade
 * would update the native header on every frame.
 */
function NativeScrollHeaderTitle({ name, scrollY }: ScrollHeaderTitleProps) {
  const colors = useColors();
  const { end } = headerTitleRange();
  const [shown, setShown] = useState(false);

  useAnimatedReaction(
    () => scrollY.value >= end,
    (past, previous) => {
      if (past !== previous) scheduleOnRN(setShown, past);
    },
  );

  return (
    <Stack.Screen
      options={{
        headerTitle: name,
        headerTitleStyle: { color: shown ? colors.text : "transparent" },
      }}
    />
  );
}

/** The nav-bar title that fades in as the hero name scrolls under it. */
function FadingHeaderTitle({ name, scrollY }: ScrollHeaderTitleProps) {
  const colors = useColors();
  const { start, end } = headerTitleRange();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [start, end],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [start, end],
          [8, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.Text
      numberOfLines={1}
      style={[styles.headerTitle, { color: colors.text }, animatedStyle]}
    >
      {name}
    </Animated.Text>
  );
}
