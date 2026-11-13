import { useCallback, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScrollHeaderTitle } from "@/components/artist/ArtistDetailLayout";
import { CollectionHero, COVER_SIZE } from "@/components/flow/CollectionPage";
import { EmptyState } from "@/components/library/EmptyState";
import { Button } from "@/components/ui/Button";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Text } from "@/components/ui/Text";
import { IS_IOS } from "@/constants/platform";
import { Colors } from "@/constants/theme";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import {
  useAddEditorialPlaylist,
  useEditorialPlaylist,
} from "@/hooks/discover/use-editorial-playlists";
import { usePreviewRows } from "@/hooks/discover/use-preview-rows";
import { useOpenPlaylist } from "@/hooks/flow/use-open-playlist";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ApiError } from "@/lib/api/client";
import { formatTrackCount } from "@/lib/discover/format";
import { EditorialArtwork } from "./EditorialArtwork";
import {
  EditorialTrackRow,
  type EditorialTrackItem,
} from "./EditorialTrackRow";

type RouteParams = {
  id: string;
  name?: string;
  artworkUrl?: string;
  trackCount?: string;
};

/** Its tracks are preview clips, not library files, so there's no queue to play. */
export function EditorialPlaylistScreen() {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  // Only iOS scrolls under its translucent header.
  const headerHeight = useHeaderHeight();
  const headerPaddingTop = (IS_IOS ? headerHeight : 0) + 24;
  const params = useLocalSearchParams<RouteParams>();
  const { id } = params;

  const {
    data: playlist,
    error,
    isPending,
    refetch,
  } = useEditorialPlaylist(id);
  const addPlaylist = useAddEditorialPlaylist(id);
  const openInLibrary = useOpenPlaylist();
  const hasFlowAccess = useHasPermission()("accessFlow");

  const {
    playingId,
    loadingId,
    progress,
    lookupRowId,
    stopPreview,
    togglePreview,
    openRowArtist,
    openRowAlbum,
  } = usePreviewRows();

  const trackItems = useMemo<EditorialTrackItem[]>(
    () =>
      (playlist?.tracks ?? []).map((track, index) => ({
        id: `deezer-${id}-${index}`,
        track,
      })),
    [playlist?.tracks, id],
  );

  const renderItem = useCallback(
    ({ item }: { item: EditorialTrackItem }) => (
      <EditorialTrackRow
        item={item}
        isPlaying={playingId === item.id}
        isLoading={loadingId === item.id}
        progress={playingId === item.id ? progress : 0}
        isLookingUpLink={lookupRowId === item.id}
        onTogglePreview={togglePreview}
        onOpenArtist={openRowArtist}
        onOpenAlbum={openRowAlbum}
      />
    ),
    [
      playingId,
      loadingId,
      progress,
      lookupRowId,
      togglePreview,
      openRowArtist,
      openRowAlbum,
    ],
  );

  const name = playlist?.name ?? params.name ?? "";

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  if (!playlist && !isPending) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <ScreenCenter>
        <EmptyState
          icon="alert-circle-outline"
          message={
            notFound
              ? "Deezer no longer has this playlist"
              : "Couldn't load this playlist"
          }
          actionLabel={notFound ? undefined : "Try Again"}
          onAction={notFound ? undefined : () => void refetch()}
        />
      </ScreenCenter>
    );
  }

  // A deep link has no card to paint the header from.
  if (!name) return <ScreenCenter loading />;

  const trackCount = playlist?.tracks.length ?? Number(params.trackCount ?? 0);
  const metaLine = [playlist?.curator, formatTrackCount(trackCount)]
    .filter(Boolean)
    .join(" · ");
  const libraryPlaylistId = playlist?.libraryPlaylistId;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollHeaderTitle name={name} scrollY={scrollY} />
      <Animated.FlatList
        data={trackItems}
        renderItem={renderItem}
        keyExtractor={(item: EditorialTrackItem) => item.id}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListHeaderComponent={
          <View style={{ paddingTop: headerPaddingTop }}>
            <CollectionHero
              name={name}
              artwork={
                <EditorialArtwork
                  name={name}
                  uri={playlist?.artworkUrl ?? params.artworkUrl ?? null}
                  size={COVER_SIZE}
                  radius={12}
                />
              }
            >
              {playlist?.description ? (
                <Text
                  variant="body"
                  numberOfLines={3}
                  style={[styles.description, { color: colors.subtle }]}
                >
                  {playlist.description}
                </Text>
              ) : null}
              {metaLine ? <Text variant="caption">{metaLine}</Text> : null}
            </CollectionHero>
            {hasFlowAccess ? (
              <View style={styles.action}>
                {libraryPlaylistId ? (
                  <Button
                    title="Open in Library"
                    variant="inline"
                    onPress={() => {
                      stopPreview();
                      void openInLibrary(libraryPlaylistId);
                    }}
                  />
                ) : (
                  // Only a loaded playlist says whether this makes a second copy.
                  <Button
                    title="Add to Library"
                    loading={addPlaylist.isPending}
                    disabled={!playlist}
                    onPress={() => addPlaylist.mutate()}
                  />
                )}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isPending ? (
            <ActivityIndicator style={styles.loader} color={colors.brand} />
          ) : (
            <Text variant="caption" style={styles.emptyText}>
              This playlist has no tracks
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    textAlign: "center",
  },
  action: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
});
