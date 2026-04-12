import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  type TextLayoutEvent,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import BottomSheet from "@gorhom/bottom-sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArtistHero } from "@/components/library/ArtistHero";
import { ArtistTags } from "@/components/library/ArtistTags";
import { PreviewTrackRow } from "@/components/library/PreviewTrackRow";
import { ReleaseGroupCard } from "@/components/library/ReleaseGroupCard";
import { ReleaseGroupSheet } from "@/components/library/ReleaseGroupSheet";
import { AlbumCard } from "@/components/library/AlbumCard";
import { AlbumSheet } from "@/components/library/AlbumSheet";
import { EmptyState } from "@/components/library/EmptyState";
import { SimilarArtistCard } from "@/components/search/SimilarArtistCard";
import { AddArtistSheet } from "@/components/search/AddArtistSheet";
import { Text } from "@/components/ui/Text";
import {
  getArtistReleaseGroups,
  deleteLibraryArtist,
  refreshLibraryArtist,
} from "@/lib/api/library";
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

const CATEGORIES: { type: PrimaryReleaseType; label: string }[] = [
  { type: "Album", label: "Albums" },
  { type: "EP", label: "EPs" },
  { type: "Single", label: "Singles" },
];

const MAX_VISIBLE = 10;

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
  const { data: libraryArtist } = useLibraryArtist(
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

  const { stop: stopPreview, ...preview } = usePreviewPlayer(mbid, artistName);
  const { data: details } = useArtistDetails(mbid);
  const { data: similarArtists } = useSimilarArtists(mbid);

  const { data: allReleaseGroups } = useQuery({
    queryKey: libraryKeys.releaseGroups(mbid),
    queryFn: () => getArtistReleaseGroups(mbid),
    staleTime: 10 * 60 * 1000,
  });

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

  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioTruncated, setBioTruncated] = useState(false);
  const onBioTextLayout = useCallback((e: TextLayoutEvent) => {
    setBioTruncated(e.nativeEvent.lines.length >= 4);
  }, []);

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

        {/* Top Tracks */}
        {preview.tracks && preview.tracks.length > 0 && (
          <View style={styles.section}>
            <Text
              variant="caption"
              style={[styles.sectionLabel, { color: colors.subtle }]}
            >
              Top Tracks
            </Text>
            {preview.tracks.map((track) => (
              <PreviewTrackRow
                key={track.id}
                track={track}
                isPlaying={preview.playingId === track.id}
                progress={preview.playingId === track.id ? preview.progress : 0}
                onToggle={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void preview.toggle(track);
                }}
              />
            ))}
          </View>
        )}

        {/* In Your Library (library artists only) */}
        {inLibrary && (
          <View style={styles.albumsSection}>
            {albumsLoading || isLoadingTypes ? (
              <ActivityIndicator style={styles.loader} color={colors.brand} />
            ) : albumsError ? (
              <EmptyState
                icon="cloud-offline-outline"
                message="Failed to load albums"
                actionLabel="Try Again"
                onAction={() => refetchAlbums()}
              />
            ) : groupedLibraryAlbums && groupedLibraryAlbums.size > 0 ? (
              <>
                <Text
                  variant="caption"
                  style={[
                    styles.sectionLabel,
                    styles.sectionLabelPadded,
                    { color: colors.subtle },
                  ]}
                >
                  In Your Library
                </Text>
                {CATEGORIES.map(({ type, label }) => {
                  const list = groupedLibraryAlbums.get(type);
                  if (!list || list.length === 0) return null;
                  const visible = list.slice(0, MAX_VISIBLE);
                  const hasMore = list.length > MAX_VISIBLE;
                  return (
                    <View key={type} style={styles.categorySection}>
                      <Pressable
                        onPress={
                          onNavigateToAlbums
                            ? () => onNavigateToAlbums(type, label)
                            : undefined
                        }
                        disabled={!onNavigateToAlbums}
                        style={({ pressed }) => [
                          styles.categoryHeader,
                          { opacity: pressed ? 0.6 : 1 },
                        ]}
                      >
                        <Text
                          variant="subtitle"
                          style={[styles.categoryTitle, { color: colors.text }]}
                        >
                          {label}
                          <Text
                            variant="caption"
                            style={{ color: colors.subtle }}
                          >
                            {"  "}
                            {list.length}
                          </Text>
                        </Text>
                        {onNavigateToAlbums && (
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.subtle}
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </Pressable>
                      <FlatList
                        horizontal
                        data={visible}
                        keyExtractor={(album) => album.id}
                        renderItem={({ item }) => (
                          <AlbumCard
                            album={item}
                            onPress={() => openAlbum(item)}
                            downloadStatus={downloadStatuses?.[item.id]?.status}
                          />
                        )}
                        ListFooterComponent={
                          hasMore && onNavigateToAlbums
                            ? () => (
                                <Pressable
                                  onPress={() =>
                                    onNavigateToAlbums(type, label)
                                  }
                                  style={({ pressed }) => [
                                    styles.viewAllCard,
                                    {
                                      backgroundColor: colors.card,
                                      opacity: pressed ? 0.7 : 1,
                                    },
                                  ]}
                                >
                                  <Ionicons
                                    name="grid-outline"
                                    size={24}
                                    color={colors.brand}
                                  />
                                  <Text
                                    variant="caption"
                                    style={{ color: colors.brand }}
                                  >
                                    View All
                                  </Text>
                                </Pressable>
                              )
                            : undefined
                        }
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.albumList}
                      />
                    </View>
                  );
                })}
              </>
            ) : (
              <EmptyState icon="disc-outline" message="No albums in library" />
            )}
          </View>
        )}

        {/* Albums & Releases */}
        {groupedReleases && groupedReleases.size > 0 && (
          <View style={styles.albumsSection}>
            <Text
              variant="caption"
              style={[
                styles.sectionLabel,
                styles.sectionLabelPadded,
                { color: colors.subtle },
              ]}
            >
              Albums & Releases
            </Text>
            {CATEGORIES.map(({ type, label }) => {
              const list = groupedReleases.get(type);
              if (!list || list.length === 0) return null;
              const visible = list.slice(0, MAX_VISIBLE);
              const hasMore = list.length > MAX_VISIBLE;
              return (
                <View key={`rg-${type}`} style={styles.categorySection}>
                  <Pressable
                    onPress={() => onNavigateToReleases(type, label)}
                    style={({ pressed }) => [
                      styles.categoryHeader,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text
                      variant="subtitle"
                      style={[styles.categoryTitle, { color: colors.text }]}
                    >
                      {label}
                      <Text variant="caption" style={{ color: colors.subtle }}>
                        {"  "}
                        {list.length}
                      </Text>
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.subtle}
                      style={{ marginLeft: 4 }}
                    />
                  </Pressable>
                  <FlatList
                    horizontal
                    data={visible}
                    keyExtractor={(rg) => rg.id}
                    renderItem={({ item }) => (
                      <ReleaseGroupCard
                        releaseGroup={item}
                        onPress={() => openReleaseGroup(item)}
                      />
                    )}
                    ListFooterComponent={
                      hasMore
                        ? () => (
                            <Pressable
                              onPress={() => onNavigateToReleases(type, label)}
                              style={({ pressed }) => [
                                styles.viewAllCard,
                                {
                                  backgroundColor: colors.card,
                                  opacity: pressed ? 0.7 : 1,
                                },
                              ]}
                            >
                              <Ionicons
                                name="grid-outline"
                                size={24}
                                color={colors.brand}
                              />
                              <Text
                                variant="caption"
                                style={{ color: colors.brand }}
                              >
                                View All
                              </Text>
                            </Pressable>
                          )
                        : undefined
                    }
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.albumList}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* Similar Artists */}
        {similarArtists && similarArtists.length > 0 && (
          <View style={styles.similarSection}>
            <Text
              variant="caption"
              style={[
                styles.sectionLabel,
                { color: colors.subtle, paddingHorizontal: 16 },
              ]}
            >
              Similar Artists
            </Text>
            <FlatList
              horizontal
              data={similarArtists}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SimilarArtistCard
                  artist={item}
                  isInLibrary={isInLibrary(item.id)}
                  onPress={() => handleSimilarPress(item)}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarList}
            />
          </View>
        )}

        {/* Bio */}
        {details?.bio && (
          <View style={styles.bioSection}>
            <Text
              variant="caption"
              style={[styles.sectionLabel, { color: colors.subtle }]}
            >
              About
            </Text>
            <Text
              variant="caption"
              style={styles.bio}
              numberOfLines={bioExpanded ? undefined : 4}
              onTextLayout={onBioTextLayout}
            >
              {details.bio}
            </Text>
            {(bioTruncated || bioExpanded) && (
              <Pressable onPress={() => setBioExpanded((prev) => !prev)}>
                <Text variant="caption" style={{ color: colors.brand }}>
                  {bioExpanded ? "Show less" : "Show more"}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* External Links */}
        <View style={styles.links}>
          <Pressable
            style={({ pressed }) => [
              styles.linkButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() =>
              Linking.openURL(
                `https://www.last.fm/music/${encodeURIComponent(artistName)}`,
              )
            }
          >
            <Ionicons name="open-outline" size={18} color={colors.brand} />
            <Text variant="caption" style={{ color: colors.text }}>
              Last.fm
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.linkButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() =>
              Linking.openURL(`https://musicbrainz.org/artist/${mbid}`)
            }
          >
            <Ionicons name="open-outline" size={18} color={colors.brand} />
            <Text variant="caption" style={{ color: colors.text }}>
              MusicBrainz
            </Text>
          </Pressable>
        </View>

        {/* Refresh (library only) */}
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

      {/* Bottom Sheets */}
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
  section: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
  },
  sectionLabelPadded: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  similarSection: {
    paddingTop: 8,
  },
  similarList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  albumsSection: {
    paddingTop: 8,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  categoryTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
  },
  albumList: {
    paddingHorizontal: 16,
  },
  viewAllCard: {
    width: 150,
    height: 150,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginRight: 12,
  },
  bioSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 6,
  },
  bio: {
    lineHeight: 18,
  },
  links: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
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
  loader: {
    paddingVertical: 32,
  },
});
