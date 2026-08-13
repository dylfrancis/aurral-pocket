import React, { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  BottomSheetModal,
  useBottomSheetScrollableCreator,
} from "@gorhom/bottom-sheet";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSheet } from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import {
  AddToPlaylistSheet,
  useAddToPlaylist,
} from "@/components/flow/AddToPlaylistSheet";
import { useAdoptDiscoverPlaylist } from "@/hooks/discover/use-adopt-discover-playlist";
import { playlistSourceLine } from "@/lib/discover/playlist-format";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type {
  DiscoverPlaylist,
  DiscoverPlaylistTrack,
} from "@/lib/types/search";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  playlist: DiscoverPlaylist | null;
  onClose: () => void;
};

type TrackItem = { track: DiscoverPlaylistTrack; key: string };

export function DiscoverPlaylistSheet({ sheetRef, playlist, onClose }: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const adopt = useAdoptDiscoverPlaylist();
  const renderScrollComponent = useBottomSheetScrollableCreator();
  const { canAddToPlaylist, ...addToPlaylist } = useAddToPlaylist();

  const pendingKind = adopt.isPending ? adopt.variables?.kind : null;

  const items: TrackItem[] = (playlist?.tracks ?? []).map((track, i) => ({
    track,
    key: `${playlist?.presetId}-${i}`,
  }));

  const openAddToPlaylist = addToPlaylist.open;
  const handleAddTrack = useCallback(
    (track: DiscoverPlaylistTrack) => {
      // The playlist API requires both names; the other fields are optional.
      if (!track.artistName || !track.trackName) return;
      openAddToPlaylist({
        artistName: track.artistName,
        trackName: track.trackName,
        albumName: track.albumName,
        artistMbid: track.artistMbid,
        albumMbid: track.albumMbid,
        trackMbid: track.trackMbid,
        releaseYear: track.releaseYear,
        reason: track.reason,
      });
    },
    [openAddToPlaylist],
  );

  const renderItem = useCallback(
    ({ item }: { item: TrackItem }) => {
      const addable =
        canAddToPlaylist && !!item.track.artistName && !!item.track.trackName;
      return (
        <View style={styles.trackRow}>
          <View style={styles.trackMeta}>
            <Text
              variant="body"
              numberOfLines={1}
              style={{ color: colors.text }}
            >
              {item.track.trackName || "Unknown track"}
            </Text>
            <Text
              variant="caption"
              numberOfLines={1}
              style={{ color: colors.subtle }}
            >
              {item.track.artistName || "Unknown artist"}
            </Text>
          </View>
          {addable ? (
            <Pressable
              onPress={() => handleAddTrack(item.track)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.track.trackName} to a playlist`}
              style={({ pressed }) => [
                styles.addButton,
                { opacity: pressed ? 0.5 : 1 },
              ]}
            >
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={colors.subtle}
              />
            </Pressable>
          ) : null}
        </View>
      );
    },
    [colors.text, colors.subtle, canAddToPlaylist, handleAddTrack],
  );

  const renderHeader = () => {
    if (!playlist) return null;
    const subtitle = playlistSourceLine(playlist);
    const adoptedAsFlow = !!playlist.adoptedFlowId;
    const adoptedAsStatic = !!playlist.adoptedPlaylistId;
    return (
      <View style={styles.headerWrap}>
        <Text
          variant="title"
          numberOfLines={2}
          style={[styles.title, { color: colors.text }]}
        >
          {playlist.name}
        </Text>
        <Text variant="caption" style={{ color: colors.subtle }}>
          {playlist.trackCount} tracks
          {subtitle ? ` · ${subtitle}` : ""}
        </Text>

        {playlist.tags.length > 0 || playlist.relatedArtists.length > 0 ? (
          <View style={styles.pills}>
            {playlist.tags.map((tag) => (
              <Chip
                key={`t-${tag}`}
                label={`#${tag}`}
                variant="subtle"
                size="sm"
              />
            ))}
            {playlist.relatedArtists.map((artist) => (
              <Chip
                key={`a-${artist}`}
                label={`~${artist}`}
                variant="subtle"
                size="sm"
              />
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            title={adoptedAsFlow ? "Added as flow" : "Add as rotating flow"}
            loading={pendingKind === "flow"}
            disabled={adoptedAsFlow || adopt.isPending}
            onPress={() =>
              adopt.mutate({ presetId: playlist.presetId, kind: "flow" })
            }
            style={styles.actionButton}
          />
          <Button
            title={
              adoptedAsStatic ? "Added as playlist" : "Add as static playlist"
            }
            variant="inline"
            disabled={adoptedAsStatic || adopt.isPending}
            loading={pendingKind === "static"}
            onPress={() =>
              adopt.mutate({ presetId: playlist.presetId, kind: "static" })
            }
            style={styles.actionButton}
          />
        </View>

        <Text
          variant="subtitle"
          style={[
            styles.tracksHeader,
            { color: colors.text, ...Fonts.semiBold },
          ]}
        >
          Tracks
        </Text>
      </View>
    );
  };

  return (
    <>
      <AppSheet
        ref={sheetRef}
        snapPoints={["85%"]}
        enablePanDownToClose
        enableDynamicSizing={false}
        onDismiss={onClose}
      >
        {playlist ? (
          <FlashList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            renderScrollComponent={renderScrollComponent}
          />
        ) : null}
      </AppSheet>
      <AddToPlaylistSheet
        track={addToPlaylist.track}
        onClose={addToPlaylist.close}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    ...Fonts.bold,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  actions: {
    gap: 8,
  },
  actionButton: {
    width: "100%",
  },
  tracksHeader: {
    paddingTop: 4,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  trackMeta: {
    flex: 1,
    gap: 2,
  },
  addButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
