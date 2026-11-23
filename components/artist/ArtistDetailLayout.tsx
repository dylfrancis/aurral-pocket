import { ArtistBioSection } from "@/components/artist/ArtistBioSection";
import { ArtistLibraryControl } from "@/components/artist/ArtistLibraryControl";
import { LibraryAlbumsSection } from "@/components/artist/LibraryAlbumsSection";
import {
  MatchArtistSheet,
  matchSavedTitle,
} from "@/components/artist/MatchArtistSheet";
import { ReleaseGroupsSection } from "@/components/artist/ReleaseGroupsSection";
import { SimilarArtistsSection } from "@/components/artist/SimilarArtistsSection";
import { ArtistSongsSection } from "@/components/artist/ArtistSongsSection";
import { ArtistHero } from "@/components/library/ArtistHero";
import { ArtistTags } from "@/components/library/ArtistTags";
import { TrackActionsSheet } from "@/components/library/TrackActionsSheet";
import { pluginMenuSection } from "@/components/plugins/PluginMenuActions";
import { useItemActions } from "@/components/actions/item-actions-context";
import { libraryAlbumTarget } from "@/components/actions/targets";
import { AddArtistSheet } from "@/components/search/AddArtistSheet";
import { useSheet } from "@/components/ui/AppSheet";
import { Fonts } from "@/constants/theme";
import { HAS_LIQUID_GLASS } from "@/constants/navigation";
import { IS_IOS } from "@/constants/platform";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import { useAlbumsWithTypes } from "@/hooks/library/use-albums-with-types";
import { useArtistDetails } from "@/hooks/library/use-artist-details";
import { useArtistSongs } from "@/hooks/library/use-artist-queue";
import { useArtistTopTracks } from "@/hooks/library/use-artist-top-tracks";
import { useArtistSongViews } from "@/hooks/library/use-artist-song-views";
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
import { useLibraryScan } from "@/hooks/library/use-library-scan";
import { useResearchMissingAlbums } from "@/hooks/library/use-research-missing-albums";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useArtistFeedback } from "@/hooks/discover/use-artist-feedback";
import { isValidMbid } from "@/lib/blocklist";
import {
  setArtistInLibrary,
  useLibraryLookup,
} from "@/hooks/search/use-library-lookup";
import { useSimilarArtists } from "@/hooks/search/use-similar-artists";
import { useStartQueue } from "@/hooks/player/use-start-queue";
import { useStartRadio } from "@/hooks/player/use-start-radio";
import { usePluginActions } from "@/hooks/plugins/use-plugin-actions";
import { deleteLibraryArtist } from "@/lib/api/library";
import { invalidateLibraryLists } from "@/hooks/library/library-lists";
import { libraryKeys } from "@/lib/query-keys";
import {
  queueTrackToPlayerTrack,
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import { groupReleasesBySection, librarySection } from "@/lib/release-groups";
import type {
  Album,
  ArtistMatchResult,
  PrimaryReleaseType,
  ReleaseGroup,
} from "@/lib/types/library";
import type { SimilarArtist } from "@/lib/types/search";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import SearchIcon from "@expo/material-symbols/search.xml";
import BlockIcon from "@expo/material-symbols/block.xml";
import CheckCircle from "@expo/material-symbols/check_circle.xml";
import Sensors from "@expo/material-symbols/sensors.xml";
import LinkIcon from "@expo/material-symbols/link.xml";
import RefreshIcon from "@expo/material-symbols/refresh.xml";
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
  /** An MBID, or the Library id of an artist without one. */
  artistRef: string;
  artistName: string;
  /** The cover the row that opened the page already has. */
  coverUrl?: string;
  onNavigateToReleases: (type: PrimaryReleaseType, label: string) => void;
  onNavigateToAlbums?: (type: PrimaryReleaseType, label: string) => void;
  onSimilarArtistPress: (artist: SimilarArtist) => void;
};

export function ArtistDetailLayout({
  artistRef,
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

  // Every read that goes through the metadata server needs the MBID.
  const mbid = isValidMbid(artistRef) ? artistRef : undefined;
  const { isInLibrary, isLoading: libraryStatusLoading } = useLibraryLookup([
    mbid,
  ]);
  // Only a Library artist has a Library id.
  const inLibrary = mbid ? isInLibrary(mbid) : true;
  const pluginActions = usePluginActions(
    "artist",
    inLibrary ? { artistId: artistRef } : null,
  );
  const { data: libraryArtist, refetch: refetchArtist } = useLibraryArtist(
    inLibrary ? mbid : undefined,
  );
  const libraryArtistId = mbid ? libraryArtist?.id : artistRef;
  const {
    data: canonicalArtist,
    isPending: canonicalArtistLoading,
    refetch: refetchCanonicalArtist,
  } = useCanonicalArtist(inLibrary ? artistRef : undefined);
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
  const albumsRef = libraryAlbumsRef({
    artistId: libraryArtistId,
    artistMbid: inLibrary ? mbid : undefined,
  });
  const {
    data: rawAlbums,
    isLoading: albumsLoading,
    error: albumsError,
    refetch: refetchAlbums,
  } = useLibraryAlbums(albumsRef);
  const {
    topTracks,
    isLoading: topTracksLoading,
    artistQueue,
  } = useArtistTopTracks(mbid, artistName, inLibrary);
  const {
    data: artistSongs,
    isLoading: artistSongsLoading,
    refetch: refetchArtistSongs,
  } = useArtistSongs(mbid ? undefined : artistRef);
  const { data: details, isPending: detailsLoading } = useArtistDetails(mbid);
  const { data: similarArtists } = useSimilarArtists(mbid);

  const allReleaseGroups = details?.["release-groups"];

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
      mbid: mbid ?? "",
      name: libraryArtist?.artistName || artistName,
    });

  const canMatch = inLibrary && hasPermission("addArtist") && !!canonicalArtist;
  const [matching, setMatching] = useState(false);
  const handleMatched = useCallback(
    (result: ArtistMatchResult) => {
      const name = libraryArtist?.artistName || artistName || "Artist";
      Burnt.toast({ title: matchSavedTitle(name, result), preset: "done" });
      // A merge moves the artist to another id, and a removed match leaves it
      // only its Library id.
      router.setParams({ mbid: result.mbid ?? String(result.id) });
    },
    [libraryArtist?.artistName, artistName, router],
  );

  // As on the web: only for files in the Library or a read-only folder.
  const canRescan =
    inLibrary &&
    !!canonicalArtist?.sources?.some(
      (source) => source === "aurral" || source === "readonly",
    );
  const libraryScan = useLibraryScan();
  const handleRescan = useCallback(() => {
    if (!canonicalArtist) return;
    const name = canonicalArtist.artistName || artistName;
    libraryScan.scan(
      { artistId: Number(canonicalArtist.id) },
      {
        started: `Rescanning ${name}`,
        done: `Rescanned ${name}`,
        failed: `Couldn't rescan ${name}`,
      },
    );
  }, [canonicalArtist, artistName, libraryScan]);

  const pollCount = useRef(0);
  useEffect(() => {
    // An artist opened by Library id is already indexed.
    if (!inLibrary || !mbid) return;
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
  }, [
    inLibrary,
    mbid,
    libraryArtist?.id,
    rawAlbums,
    refetchArtist,
    refetchAlbums,
  ]);

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
    return new Set(rawAlbums.map((a) => a.mbid));
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

  const addArtistSheet = useSheet();
  const { openAlbum: openAlbumActions } = useItemActions();

  const openReleaseGroup = useCallback(
    (rg: ReleaseGroup) => {
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
    [router, artistName, mbid, libraryArtist?.id],
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
      if (mbid) setArtistInLibrary(queryClient, mbid, false);
      invalidateLibraryLists(queryClient);
    },
  });

  const handleRemove = useCallback(() => {
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
  const feedback = useArtistFeedback(
    { mbid, name: artistName },
    "artist_detail",
  );
  const isBlocked = feedback.isSet("block_artist");

  const refreshArtist = useCallback(
    () =>
      Promise.all([
        refetchAlbums(),
        refetchCanonicalArtist(),
        ...(mbid
          ? [
              queryClient.invalidateQueries({
                queryKey: libraryKeys.artistMonitoring(mbid),
              }),
              queryClient.invalidateQueries({
                queryKey: libraryKeys.artistQueue(mbid),
              }),
            ]
          : [refetchArtistSongs()]),
      ]),
    [
      refetchAlbums,
      refetchCanonicalArtist,
      refetchArtistSongs,
      queryClient,
      mbid,
    ],
  );
  const { refreshing, onRefresh } = usePullToRefresh(refreshArtist);

  const startQueue = useStartQueue();
  // Built at the tap: each URL carries the session token.
  const playableCount = mbid ? artistQueue?.length : artistSongs?.length;
  const playArtist = useCallback(
    (shuffled: boolean) => {
      const items = (
        mbid
          ? (artistQueue ?? []).map((track) =>
              queueTrackToPlayerTrack(track, null),
            )
          : (artistSongs ?? []).map((song) =>
              toPlayerTrack(song, albumTrackContext(song, queryClient)),
            )
      ).filter((item): item is PlayerTrack => item !== null);
      const context: PlayerAlbumContext = {
        albumTitle: artistName,
        artistName,
        coverPath: null,
        artworkUrl: null,
        albumMbid: null,
        artistMbid: mbid ?? null,
      };
      void startQueue(items, context, { shuffled });
    },
    [artistQueue, artistSongs, artistName, mbid, queryClient, startQueue],
  );

  const songs = useArtistSongViews({
    mbid,
    libraryArtistId: canonicalArtist?.id ?? (mbid ? undefined : artistRef),
    artistName,
    inLibrary,
    topTracks,
    topTracksLoading,
    // Top Tracks' own loading covers the artist queue.
    libraryLoading: inLibrary && (canonicalArtistLoading || artistSongsLoading),
    hasSongs: !!playableCount,
  });

  const startRadio = useStartRadio();
  // The MBID finds the Library artist. A name could also match another artist
  // who shares it.
  const handleStartRadio = useCallback(() => {
    void startRadio({
      seed: {
        artists: [
          {
            id: canonicalArtist?.id ?? libraryArtistId ?? null,
            mbid: mbid ?? null,
          },
        ],
      },
      label: artistName,
    });
  }, [startRadio, canonicalArtist?.id, libraryArtistId, mbid, artistName]);

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
          {inLibrary && (
            <Stack.Toolbar.MenuAction
              icon={IS_IOS ? "dot.radiowaves.left.and.right" : Sensors}
              onPress={handleStartRadio}
            >
              Start Radio
            </Stack.Toolbar.MenuAction>
          )}
          {inLibrary && canResearchMissing && mbid ? (
            <Stack.Toolbar.MenuAction
              icon={IS_IOS ? "magnifyingglass" : SearchIcon}
              hidden={missingCount === 0}
              disabled={isResearching}
              onPress={() => researchMissing()}
            >
              {`Re-search Missing (${missingCount})`}
            </Stack.Toolbar.MenuAction>
          ) : null}
          {canMatch ? (
            <Stack.Toolbar.MenuAction
              icon={IS_IOS ? "link" : LinkIcon}
              onPress={() => setMatching(true)}
            >
              Match Artist
            </Stack.Toolbar.MenuAction>
          ) : null}
          {canRescan ? (
            <Stack.Toolbar.MenuAction
              icon={IS_IOS ? "arrow.clockwise" : RefreshIcon}
              disabled={libraryScan.isScanning}
              onPress={handleRescan}
            >
              Rescan Files
            </Stack.Toolbar.MenuAction>
          ) : null}
          {pluginMenuSection(pluginActions)}
          {/* The blocklist names artists by MBID. */}
          {mbid ? (
            <Stack.Toolbar.MenuAction
              icon={
                IS_IOS
                  ? isBlocked
                    ? "checkmark.circle"
                    : "nosign"
                  : isBlocked
                    ? CheckCircle
                    : BlockIcon
              }
              // Native menus only offer the platform destructive style, so red
              // here is the system red rather than the theme's error token.
              destructive={!isBlocked}
              disabled={feedback.isPending}
              onPress={() => feedback.toggle("block_artist")}
            >
              {isBlocked ? "Unblock Artist" : "Block Artist"}
            </Stack.Toolbar.MenuAction>
          ) : null}
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
              mbid: mbid ?? "",
              artistName,
              coverUrl: canonicalArtist?.coverUrl || coverUrl,
            }}
            listeners={details?.listeners}
            scrollY={scrollY}
            refreshing={refreshing}
            inLibrary={libraryStatusLoading ? undefined : inLibrary}
            // The capsule's monitoring takes the MBID.
            libraryControl={
              mbid ? (
                <ArtistLibraryControl
                  mbid={mbid}
                  artistName={libraryArtist?.artistName || artistName}
                  onRemove={libraryArtist ? handleRemove : undefined}
                />
              ) : undefined
            }
            play={{
              disabled: !playableCount,
              onPlay: () => playArtist(false),
              onShuffle: () => playArtist(true),
            }}
            // Shows while the artist loads, so the heart doesn't pop in and
            // shift Play off center.
            favorite={
              canonicalArtistLoading || canonicalArtist?.identityKey
                ? { active: isFavorite, onToggle: handleToggleFavorite }
                : undefined
            }
            onAddPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              addArtistSheet.present();
            }}
          />
        </View>

        {mbid ? <ArtistTags mbid={mbid} /> : null}

        <ArtistSongsSection
          title={songs.title}
          currentLabel={songs.currentLabel}
          pills={songs.pills}
          selected={songs.selected}
          onSelect={songs.select}
          songs={songs.songs}
          isLoading={songs.isLoading}
          itemIds={songs.itemIds}
          currentId={songs.currentId}
          isPlaying={songs.isPlaying}
          onPlayFrom={songs.playFrom}
          onPlayAll={songs.playAll}
          onOpenActions={songs.openActions}
          onShowAll={songs.showAll}
        />

        {inLibrary && (
          <LibraryAlbumsSection
            grouped={groupedLibraryAlbums}
            isLoading={albumsLoading || isLoadingTypes}
            error={albumsError}
            downloadStatuses={downloadStatuses}
            onAlbumPress={openAlbum}
            onAlbumLongPress={(album) =>
              openAlbumActions(
                libraryAlbumTarget(album, { name: artistName, mbid }),
              )
            }
            onNavigate={onNavigateToAlbums}
            onRetry={() => refetchAlbums()}
          />
        )}

        <ReleaseGroupsSection
          grouped={groupedReleases}
          isLoading={!inLibrary && detailsLoading}
          onPress={openReleaseGroup}
          onLongPress={(rg) =>
            openAlbumActions({
              mbid: rg.id,
              title: rg.title,
              artistName,
              artistMbid: mbid,
              artistId: libraryArtist?.id,
              releaseDate: rg["first-release-date"],
              showArtist: false,
            })
          }
          onNavigate={onNavigateToReleases}
        />

        <SimilarArtistsSection
          artists={similarArtists ?? []}
          onPress={onSimilarArtistPress}
        />

        {mbid ? (
          <ArtistBioSection
            bio={details?.bio}
            artistName={artistName}
            mbid={mbid}
          />
        ) : null}
      </Animated.ScrollView>

      {/* Kept once the artist is in, so the sheet can finish closing. */}
      {mbid ? (
        <AddArtistSheet
          mbid={mbid}
          artistName={artistName}
          sheet={addArtistSheet}
          onAdded={() => {
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          }}
        />
      ) : null}

      {matching && canonicalArtist ? (
        <MatchArtistSheet
          libraryArtistId={canonicalArtist.id}
          artistName={libraryArtist?.artistName || artistName}
          currentMbid={mbid}
          onSaved={handleMatched}
          onDismiss={() => setMatching(false)}
        />
      ) : null}

      <TrackActionsSheet
        target={songs.actions.target}
        onClose={songs.actions.close}
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
