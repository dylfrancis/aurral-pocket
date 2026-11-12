import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheetView, type BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AddToPlaylistSheet,
  useAddToPlaylist,
} from "@/components/flow/AddToPlaylistSheet";
import { AppSheet } from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { useToggleFavorite } from "@/hooks/library/use-library-favorites";
import { useQueueActions } from "@/hooks/library/use-queue-actions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import type { SharedPlaylistTrack } from "@/lib/types/flow";
import type { Track } from "@/lib/types/library";

type TrackActionsTarget = {
  track: Track;
  album: PlayerAlbumContext;
};

export function useTrackActions() {
  const [target, setTarget] = useState<TrackActionsTarget | null>(null);

  const open = useCallback((track: Track, album: PlayerAlbumContext) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTarget({ track, album });
  }, []);

  const close = useCallback(() => setTarget(null), []);

  return { target, open, close };
}

/** The playlist sheet stays outside the content, because it opens as this closes. */
export function TrackActionsSheet({
  target,
  onClose,
}: {
  target: TrackActionsTarget | null;
  onClose: () => void;
}) {
  const addToPlaylist = useAddToPlaylist();

  return (
    <>
      {target && (
        <TrackActionsContent
          target={target}
          canAddToPlaylist={addToPlaylist.canAddToPlaylist}
          onAddToPlaylist={addToPlaylist.open}
          onClose={onClose}
        />
      )}
      <AddToPlaylistSheet
        track={addToPlaylist.track}
        onClose={addToPlaylist.close}
      />
    </>
  );
}

function TrackActionsContent({
  target,
  canAddToPlaylist,
  onAddToPlaylist,
  onClose,
}: {
  target: TrackActionsTarget;
  canAddToPlaylist: boolean;
  onAddToPlaylist: (track: SharedPlaylistTrack) => void;
  onClose: () => void;
}) {
  const { track, album } = target;
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const { playNext, addToQueue } = useQueueActions();
  const toggleFavorite = useToggleFavorite();
  const { identityKey } = track;
  const isFavorite = track.userFavorite === true;

  // On every open, not just on mount: a row tapped while the sheet is still
  // closing reopens it for that row.
  useEffect(() => {
    sheetRef.current?.present();
  }, [target]);

  const closeThen = (action: () => void) => () => {
    sheetRef.current?.dismiss();
    action();
  };

  return (
    <AppSheet
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onClose}
    >
      <BottomSheetView
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.sheetTitleRow}>
          <Text variant="subtitle" numberOfLines={1} style={styles.sheetTitle}>
            {track.trackName}
          </Text>
          {track.hasFile && !!track.quality && (
            <View
              style={[
                styles.qualityBadge,
                { backgroundColor: `${colors.brand}20` },
              ]}
            >
              <Text
                variant="caption"
                style={[styles.qualityText, { color: colors.brand }]}
              >
                {track.quality}
              </Text>
            </View>
          )}
        </View>
        <SheetAction
          icon="play-forward-outline"
          label="Play Next"
          onPress={closeThen(() => void playNext([track], album))}
        />
        <SheetAction
          icon="list-outline"
          label="Add to Queue"
          onPress={closeThen(() => void addToQueue([track], album))}
        />
        {/* A playlist track needs an artist name, so the permission alone is
            not enough to offer the action. */}
        {canAddToPlaylist && !!album.artistName && (
          <SheetAction
            icon="add-circle-outline"
            label="Add to Playlist"
            onPress={closeThen(() =>
              onAddToPlaylist({
                artistName: album.artistName,
                trackName: track.trackName,
                albumName: album.albumTitle,
                artistMbid: album.artistMbid,
              }),
            )}
          />
        )}
        {!!identityKey && (
          <SheetAction
            icon={isFavorite ? "heart" : "heart-outline"}
            label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            onPress={closeThen(() =>
              toggleFavorite.mutate({
                kind: "song",
                key: identityKey,
                starred: !isFavorite,
              }),
            )}
          />
        )}
      </BottomSheetView>
    </AppSheet>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sheetRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 4,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  sheetTitle: {
    // Shrinks before the badge does, so a long name still shows the quality.
    flexShrink: 1,
  },
  qualityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  qualityText: {
    fontSize: 10,
    ...Fonts.medium,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
});
