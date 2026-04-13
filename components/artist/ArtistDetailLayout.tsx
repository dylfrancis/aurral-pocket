import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  View,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import BottomSheet from "@gorhom/bottom-sheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArtistHero } from "@/components/library/ArtistHero";
import { ArtistTags } from "@/components/library/ArtistTags";
import { ReleaseGroupSheet } from "@/components/library/ReleaseGroupSheet";
import { AlbumSheet } from "@/components/library/AlbumSheet";
import { AddArtistSheet } from "@/components/search/AddArtistSheet";
import { TopTracksSection } from "@/components/artist/TopTracksSection";
import { LibraryAlbumsSection } from "@/components/artist/LibraryAlbumsSection";
import { ReleaseGroupsSection } from "@/components/artist/ReleaseGroupsSection";
import { SimilarArtistsSection } from "@/components/artist/SimilarArtistsSection";
import { ArtistBioSection } from "@/components/artist/ArtistBioSection";
import { Text } from "@/components/ui/Text";
import { deleteLibraryArtist, refreshLibraryArtist } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import { usePreviewPlayer } from "@/hooks/library/use-preview-player";
import { useArtistDetails } from "@/hooks/library/use-artist-details";
import { useLibraryArtist } from "@/hooks/library/use-library-artist";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import { useAlbumsWithTypes } from "@/hooks/library/use-albums-with-types";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { useSimilarArtists } from "@/hooks/search/use-similar-artists";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import type {
  Album,
  PrimaryReleaseType,
  ReleaseGroup,
} from "@/lib/types/library";
import type { SimilarArtist } from "@/lib/types/search";

function sortByDate(albums: Album[]): Album[] {
  return albums.slice().sort((a, b) => {
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return (
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );
  });
}

function sortReleaseGroupsByDate(rgs: ReleaseGroup[]): ReleaseGroup[] {
  return rgs.slice().sort((a, b) => {
    if (!a["first-release-date"]) return 1;
    if (!b["first-release-date"]) return -1;
    return (
      new Date(b["first-release-date"]).getTime() -
      new Date(a["first-release-date"]).getTime()
    );
  });
}

const CATEGORIES: { type: PrimaryReleaseType; label: string }[] = [
  { type: "Album", label: "Albums" },
  { type: "EP", label: "EPs" },
  { type: "Single", label: "Singles" },
];

type ArtistDetailLayoutProps = {
  mbid: string;
  artistName: string;
  onNavigateToReleases: (type: PrimaryReleaseType, label: string) => void;
  onNavigateToAlbums?: (type: PrimaryReleaseType, label: string) => void;
  onSimilarArtistPress: (artist: SimilarArtist) => void;
};

export function ArtistDetailLayout({
  mbid,
  artistName,
  onNavigateToReleases,
  onNavigateToAlbums,
  onSimilarArtistPress,
}: ArtistDetailLayoutProps) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { isInLibrary } = useLibraryLookup();
  const inLibrary = isInLibrary(mbid);
  const { data: libraryArtist, refetch: refetchArtist } = useLibraryArtist(
    inLibrary ? mbid : undefined,
  );
  const {
    data: rawAlbums,
    isLoading: albumsLoading,
    error: albumsError,
    refetch: refetchAlbums,
  } = useLibraryAlbums(libraryArtist?.id);
  const { albums: typedAlbums, isLoadingTypes } = useAlbumsWithTypes(
    inLibrary ? mbid : undefined,
    rawAlbums,
  );
  const { data: downloadStatuses } = useDownloadStatuses(rawAlbums);

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

  const { stop: stopPreview, ...preview } = usePreviewPlayer(mbid, artistName);
  const { data: details } = useArtistDetails(mbid);
  const { data: similarArtists } = useSimilarArtists(mbid);

  const allReleaseGroups = details?.releaseGroups;

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
    const filtered = allReleaseGroups.filter(
      (rg) => !libraryAlbumMbids.has(rg.id),
    );
    const map = new Map<PrimaryReleaseType, ReleaseGroup[]>();
    for (const rg of filtered) {
      const type = (rg["primary-type"] ?? "Album") as PrimaryReleaseType;
      if (!CATEGORIES.some((c) => c.type === type)) continue;
      const list = map.get(type) ?? [];
      list.push(rg);
      map.set(type, list);
    }
    for (const [key, list] of map) {
      map.set(key, sortReleaseGroupsByDate(list));
    }
    return map;
  }, [allReleaseGroups, libraryAlbumMbids]);

  const groupedLibraryAlbums = useMemo(() => {
    if (!typedAlbums) return null;
    const map = new Map<PrimaryReleaseType, Album[]>();
    for (const album of typedAlbums) {
      const type = album.albumType ?? "Album";
      const list = map.get(type) ?? [];
      list.push(album);
      map.set(type, list);
    }
    for (const [key, list] of map) {
      map.set(key, sortByDate(list));
    }
    return map;
  }, [typedAlbums]);

  const releaseGroupSheetRef = useRef<BottomSheet>(null);
  const [selectedReleaseGroup, setSelectedReleaseGroup] =
    useState<ReleaseGroup | null>(null);
  const albumSheetRef = useRef<BottomSheet>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const addArtistSheetRef = useRef<BottomSheet>(null);

  const openReleaseGroup = useCallback(
    (rg: ReleaseGroup) => {
      stopPreview();
      setSelectedReleaseGroup(rg);
      releaseGroupSheetRef.current?.snapToIndex(0);
    },
    [stopPreview],
  );

  const openAlbum = useCallback((album: Album) => {
    setSelectedAlbum(album);
    albumSheetRef.current?.snapToIndex(0);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLibraryArtist(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: libraryKeys.artists() });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshLibraryArtist(mbid),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.artist(mbid),
      });
      if (libraryArtist) {
        void queryClient.invalidateQueries({
          queryKey: libraryKeys.albums(libraryArtist.id),
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

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchAlbums();
    setRefreshing(false);
  }, [refetchAlbums]);

  const handleSimilarPress = useCallback(
    (artist: SimilarArtist) => {
      stopPreview();
      onSimilarArtistPress(artist);
    },
    [stopPreview, onSimilarArtistPress],
  );

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          inLibrary ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="transparent"
            />
          ) : undefined
        }
      >
        <ArtistHero
          artist={{ mbid, artistName }}
          scrollY={scrollY}
          refreshing={refreshing}
          inLibrary={inLibrary}
          onBadgePress={handleBadgePress}
          onAddPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            addArtistSheetRef.current?.snapToIndex(0);
          }}
        />

        <ArtistTags mbid={mbid} />

        <TopTracksSection
          tracks={preview.tracks ?? []}
          playingId={preview.playingId}
          progress={preview.progress}
          onToggle={preview.toggle}
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
          onPress={openReleaseGroup}
          onNavigate={onNavigateToReleases}
        />

        <SimilarArtistsSection
          artists={similarArtists ?? []}
          isInLibrary={isInLibrary}
          onPress={handleSimilarPress}
        />

        <ArtistBioSection
          bio={details?.bio}
          artistName={artistName}
          mbid={mbid}
        />

        {inLibrary && (
          <View style={styles.refreshRow}>
            <Pressable
              onPress={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              style={({ pressed }) => [
                styles.refreshButton,
                { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              {refreshMutation.isPending ? (
                <ActivityIndicator size={16} color={colors.brand} />
              ) : (
                <Ionicons name="sync-outline" size={18} color={colors.brand} />
              )}
              <Text variant="caption" style={{ color: colors.text }}>
                {refreshMutation.isSuccess ? "Refreshed" : "Refresh"}
              </Text>
            </Pressable>
          </View>
        )}
      </Animated.ScrollView>

      <ReleaseGroupSheet
        releaseGroup={selectedReleaseGroup}
        artistId={libraryArtist?.id}
        artistName={artistName}
        sheetRef={releaseGroupSheetRef}
      />

      {inLibrary && (
        <AlbumSheet
          album={selectedAlbum}
          artistName={artistName}
          sheetRef={albumSheetRef}
          onDeleted={() => setSelectedAlbum(null)}
          downloadStatus={
            selectedAlbum
              ? downloadStatuses?.[selectedAlbum.id]?.status
              : undefined
          }
        />
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  refreshRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
});
