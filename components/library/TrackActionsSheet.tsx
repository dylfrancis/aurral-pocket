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
import {
  useIsFavoriteTrack,
  useToggleFavorite,
} from "@/hooks/library/use-library-favorites";
import type { TrackFavorite } from "@/lib/api/library";
import { useQueueActions } from "@/hooks/library/use-queue-actions";
import { useSongSave } from "@/hooks/offline/use-song-save";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import {
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type {
  TrackMenuAction,
  TrackMenuActionId,
} from "@/components/player/track-menu-types";
import type { SharedPlaylistTrack } from "@/lib/types/flow";
import type { Track } from "@/lib/types/library";

/** Actions a page adds below the common ones, such as a playlist's own. */
export type TrackSheetExtras = {
  actions: TrackMenuAction[];
  onAction: (id: TrackMenuActionId) => void;
};

type ItemOptions = {
  /** Shown when there's no playable item to take it from. */
  title?: string;
  /** False when the stream isn't the track's own file, as for a clip. */
  canSaveOffline?: boolean;
  extras?: TrackSheetExtras;
};

/**
 * A library track from an album or the favorites, or a track in the player's
 * shape, such as a playlist's or a song saved on the phone. A playlist track
 * that can't play yet has no item, and offers only its page's own actions.
 */
type TrackActionsTarget =
  | { track: Track; album: PlayerAlbumContext }
  | ({ item: PlayerTrack | null; album: PlayerAlbumContext } & ItemOptions);

export function useTrackActions() {
  const [target, setTarget] = useState<TrackActionsTarget | null>(null);

  const open = useCallback((track: Track, album: PlayerAlbumContext) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTarget({ track, album });
  }, []);

  const openItem = useCallback(
    (
      item: PlayerTrack | null,
      album: PlayerAlbumContext,
      options: ItemOptions = {},
    ) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTarget({ item, album, ...options });
    },
    [],
  );

  const close = useCallback(() => setTarget(null), []);

  return { target, open, openItem, close };
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
  const { album } = target;
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const queue = useQueueActions();
  const songSave = useSongSave();
  const options: ItemOptions = "item" in target ? target : {};
  const item = "item" in target ? target.item : null;
  const track = "track" in target ? target.track : null;
  const playerTrack = item ?? (track ? toPlayerTrack(track, album) : null);
  const canQueue = !!item || !!track;
  const saveAction =
    options.canSaveOffline === false ? null : songSave.actionFor(playerTrack);
  const title = item?.title ?? options.title ?? track?.trackName ?? "";
  const quality = item
    ? item.audioFormat
    : track?.hasFile
      ? track.quality
      : null;
  const playNext = () =>
    item
      ? queue.playItemsNext([item], album)
      : track && queue.playNext([track], album);
  const addToQueue = () =>
    item
      ? queue.addItemsToQueue([item], album)
      : track && queue.addToQueue([track], album);
  // A playlist track needs an artist name, so the permission alone is not
  // enough to offer the action.
  const playlistTrack: SharedPlaylistTrack | null = item
    ? item.artist
      ? {
          artistName: item.artist,
          trackName: item.title,
          albumName: item.album || null,
          artistMbid: item.artistMbid,
          albumMbid: item.albumMbid,
          trackMbid: item.trackMbid,
        }
      : null
    : track && album.artistName
      ? {
          artistName: album.artistName,
          trackName: track.trackName,
          albumName: album.albumTitle,
          artistMbid: album.artistMbid,
        }
      : null;

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
            {title}
          </Text>
          {!!quality && (
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
                {quality}
              </Text>
            </View>
          )}
        </View>
        {canQueue ? (
          <>
            <SheetAction
              icon="play-forward-outline"
              label="Play Next"
              onPress={closeThen(() => void playNext())}
            />
            <SheetAction
              icon="list-outline"
              label="Add to Queue"
              onPress={closeThen(() => void addToQueue())}
            />
          </>
        ) : null}
        {canAddToPlaylist && playlistTrack && (
          <SheetAction
            icon="add-circle-outline"
            label="Add to Playlist"
            onPress={closeThen(() => onAddToPlaylist(playlistTrack))}
          />
        )}
        {track?.identityKey ? (
          <FavoriteAction
            favorite={{ kind: "song", key: track.identityKey }}
            isFavorite={track.userFavorite === true}
            closeThen={closeThen}
          />
        ) : item?.favorite ? (
          <QueuedFavoriteAction
            favorite={item.favorite}
            trackMbid={item.trackMbid}
            closeThen={closeThen}
          />
        ) : null}
        {saveAction && playerTrack ? (
          <SheetAction
            icon={SAVE_ICONS[saveAction.id] ?? "arrow-down-circle-outline"}
            label={saveAction.title}
            disabled={saveAction.disabled}
            onPress={closeThen(() => songSave.run(saveAction.id, playerTrack))}
          />
        ) : null}
        {options.extras?.actions.map((action) => (
          <SheetAction
            key={action.id}
            icon={EXTRA_ICONS[action.id] ?? "ellipsis-horizontal"}
            label={action.title}
            destructive={action.destructive}
            disabled={action.disabled}
            onPress={closeThen(() => options.extras?.onAction(action.id))}
          />
        ))}
      </BottomSheetView>
    </AppSheet>
  );
}

function FavoriteAction({
  favorite,
  isFavorite,
  closeThen,
}: {
  favorite: TrackFavorite;
  isFavorite: boolean;
  closeThen: (action: () => void) => () => void;
}) {
  const toggleFavorite = useToggleFavorite();
  return (
    <SheetAction
      icon={isFavorite ? "heart" : "heart-outline"}
      label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
      onPress={closeThen(() =>
        toggleFavorite.mutate({ ...favorite, starred: !isFavorite }),
      )}
    />
  );
}

/**
 * A queued track doesn't know whether it's a favorite, so the server's list
 * says, as it does for the player's heart. Held back until it has.
 */
function QueuedFavoriteAction({
  favorite,
  trackMbid,
  closeThen,
}: {
  favorite: TrackFavorite;
  trackMbid: string | null;
  closeThen: (action: () => void) => () => void;
}) {
  const { data: isFavorite, isPending } = useIsFavoriteTrack(
    favorite,
    trackMbid,
  );
  if (isPending || isFavorite === undefined) return null;
  return (
    <FavoriteAction
      favorite={favorite}
      isFavorite={isFavorite}
      closeThen={closeThen}
    />
  );
}

const EXTRA_ICONS: Partial<
  Record<TrackMenuActionId, keyof typeof Ionicons.glyphMap>
> = {
  download: "cloud-download-outline",
  retry: "refresh-outline",
  stop: "stop-circle-outline",
  remove: "trash-outline",
};

const SAVE_ICONS: Partial<
  Record<TrackMenuActionId, keyof typeof Ionicons.glyphMap>
> = {
  "save-offline": "arrow-down-circle-outline",
  "remove-offline": "close-circle-outline",
  "saved-with": "arrow-down-circle",
};

function SheetAction({
  icon,
  label,
  onPress,
  disabled = false,
  destructive = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const colors = Colors[useColorScheme()];
  const color = disabled
    ? colors.subtle
    : destructive
      ? colors.error
      : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.sheetRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text variant="body" style={{ color }}>
        {label}
      </Text>
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
