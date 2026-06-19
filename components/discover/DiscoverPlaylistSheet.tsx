import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import {
  BottomSheetModal,
  useBottomSheetScrollableCreator,
} from "@gorhom/bottom-sheet";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSheet } from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
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

  const pendingKind = adopt.isPending ? adopt.variables?.kind : null;

  const items: TrackItem[] = (playlist?.tracks ?? []).map((track, i) => ({
    track,
    key: `${playlist?.presetId}-${i}`,
  }));

  const renderItem = useCallback(
    ({ item }: { item: TrackItem }) => (
      <View style={styles.trackRow}>
        <Text variant="body" numberOfLines={1} style={{ color: colors.text }}>
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
    ),
    [colors.text, colors.subtle],
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
            { color: colors.text, fontFamily: Fonts.semiBold },
          ]}
        >
          Tracks
        </Text>
      </View>
    );
  };

  return (
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
    fontFamily: Fonts.bold,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 2,
  },
});
