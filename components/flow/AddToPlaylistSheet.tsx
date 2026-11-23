import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  AppSheet,
  AppSheetScrollView,
  useSheet,
} from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { NewPlaylistSheet } from "./NewPlaylistSheet";
import { CollectionArtwork } from "./CollectionArtwork";
import { useAddSharedPlaylistTracks } from "@/hooks/flow/use-flow-mutations";
import { useSharedPlaylists } from "@/hooks/flow/use-flow-selectors";
import { usePlaylistsContaining } from "@/hooks/flow/use-playlists-containing";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { Fonts } from "@/constants/theme";
import type { ApiError } from "@/lib/api/client";
import type { SharedPlaylist, SharedPlaylistTrack } from "@/lib/types/flow";
import { useColors } from "@/hooks/use-colors";

const ROW_ARTWORK_SIZE = 44;

type Props = {
  /** The track to save. The sheet is closed while this is null. */
  track: SharedPlaylistTrack | null;
  onClose: () => void;
};

/**
 * State and permission gate for one AddToPlaylistSheet. `open` sets the track
 * and gives haptic feedback; wire it to a long-press only when
 * `canAddToPlaylist` is true, because the playlist API answers 403 without
 * the accessPlaylists permission.
 */
export function useAddToPlaylist() {
  const hasPermission = useHasPermission();
  const canAddToPlaylist = hasPermission("accessPlaylists");
  const [track, setTrack] = useState<SharedPlaylistTrack | null>(null);

  const open = useCallback((next: SharedPlaylistTrack) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTrack(next);
  }, []);

  const close = useCallback(() => setTrack(null), []);

  return { canAddToPlaylist, track, open, close };
}

/**
 * Bottom sheet that saves one track into a static playlist — an existing one,
 * or a new one named in a sheet on top. Mounted only while a track is set, so the flow
 * status query behind useSharedPlaylists() does not run until the sheet opens.
 * Callers must gate on the accessPlaylists permission; that query 403s without it.
 */
export function AddToPlaylistSheet({ track, onClose }: Props) {
  if (!track) return null;
  return <AddToPlaylistSheetContent track={track} onClose={onClose} />;
}

function AddToPlaylistSheetContent({
  track,
  onClose,
}: {
  track: SharedPlaylistTrack;
  onClose: () => void;
}) {
  const colors = useColors();
  const sheet = useSheet({ presented: true, onClosed: onClose });
  const closeSheet = sheet.close;
  const [isNaming, setIsNaming] = useState(false);

  const playlists = useSharedPlaylists();
  const addTracks = useAddSharedPlaylistTracks();
  const isPending = addTracks.isPending;

  // The server skips an append when the playlist already contains the track,
  // so a tap there would toast "Added" while changing nothing.
  const { data: containingIds } = usePlaylistsContaining(track);

  const finishSuccess = useCallback(
    (title: string) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Burnt.toast({ title, preset: "done" });
      closeSheet();
    },
    [closeSheet],
  );

  const finishError = useCallback((title: string, err: unknown) => {
    Burnt.toast({
      title,
      message: (err as ApiError)?.message,
      preset: "error",
    });
  }, []);

  const handlePick = (playlist: SharedPlaylist) => {
    if (isPending) return;
    addTracks.mutate(
      { playlistId: playlist.id, tracks: [track] },
      {
        onSuccess: () => finishSuccess(`Added to "${playlist.name}"`),
        onError: (err) => finishError("Couldn't add track", err),
      },
    );
  };

  const subtitle = `"${track.trackName}" · ${track.artistName}`;

  return (
    <AppSheet sheet={sheet} background="card">
      <AppSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="title" style={[styles.title, { ...Fonts.semiBold }]}>
          Add to Playlist
        </Text>
        <Text
          variant="caption"
          numberOfLines={1}
          style={[styles.subtitle, { color: colors.subtle }]}
        >
          {subtitle}
        </Text>

        <View style={[styles.list, { borderColor: colors.separator }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsNaming(true)}
            style={({ pressed }) => [
              styles.playlistRow,
              { borderBottomColor: colors.separator },
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View
              style={[styles.newIcon, { backgroundColor: colors.brandMuted }]}
            >
              <Ionicons name="add" size={24} color={colors.brandStrong} />
            </View>
            <Text variant="body" style={{ ...Fonts.medium }}>
              New Playlist
            </Text>
          </Pressable>
          {playlists.map((playlist) => {
            const alreadyAdded = !!containingIds?.includes(playlist.id);
            return (
              <Pressable
                key={playlist.id}
                onPress={() => handlePick(playlist)}
                disabled={isPending || alreadyAdded}
                accessibilityLabel={
                  alreadyAdded
                    ? `Already in ${playlist.name}`
                    : `Add to ${playlist.name}`
                }
                style={({ pressed }) => [
                  styles.playlistRow,
                  { borderBottomColor: colors.separator },
                  {
                    opacity: pressed || isPending || alreadyAdded ? 0.6 : 1,
                  },
                ]}
              >
                <CollectionArtwork
                  collection={playlist}
                  kind="playlist"
                  size={ROW_ARTWORK_SIZE}
                  radius={8}
                />
                <View style={styles.playlistBody}>
                  <Text
                    variant="body"
                    numberOfLines={1}
                    style={{ ...Fonts.medium }}
                  >
                    {playlist.name}
                  </Text>
                  <Text variant="caption">
                    {alreadyAdded
                      ? "Already added"
                      : playlist.trackCount === 1
                        ? "1 track"
                        : `${playlist.trackCount} tracks`}
                  </Text>
                </View>
                {alreadyAdded ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.brand}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </AppSheetScrollView>
      {isNaming ? (
        <NewPlaylistSheet
          track={track}
          subtitle={subtitle}
          onCreated={(name) => finishSuccess(`Created "${name}"`)}
          onFailed={(err) => finishError("Couldn't create playlist", err)}
          onDismiss={() => setIsNaming(false)}
        />
      ) : null}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  newIcon: {
    width: ROW_ARTWORK_SIZE,
    height: ROW_ARTWORK_SIZE,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistBody: {
    flex: 1,
    gap: 2,
  },
});
