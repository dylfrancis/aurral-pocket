import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSheet } from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
// Imported from the hook modules, not the @/hooks/flow barrel: the barrel
// pulls in use-flow-audio-preview and with it expo-audio, which artist-page
// consumers of this sheet do not otherwise load.
import {
  useAddSharedPlaylistTracks,
  useCreateSharedPlaylist,
} from "@/hooks/flow/use-flow-mutations";
import { useSharedPlaylists } from "@/hooks/flow/use-flow-selectors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { ApiError } from "@/lib/api/client";
import type { SharedPlaylist, SharedPlaylistTrack } from "@/lib/types/flow";

type Props = {
  /** The track to save. The sheet is closed while this is null. */
  track: SharedPlaylistTrack | null;
  onClose: () => void;
};

/**
 * Bottom sheet that saves one track into a static playlist — an existing one,
 * or a new one named inline. Mounted only while a track is set, so the flow
 * status query behind useSharedPlaylists() does not run until the sheet opens.
 * Callers must gate on the accessFlow permission; that query 403s without it.
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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [draftName, setDraftName] = useState("");

  const playlists = useSharedPlaylists();
  const addTracks = useAddSharedPlaylistTracks();
  const createPlaylist = useCreateSharedPlaylist();
  const isPending = addTracks.isPending || createPlaylist.isPending;

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const finishSuccess = useCallback((title: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Burnt.toast({ title, preset: "done" });
    sheetRef.current?.dismiss();
  }, []);

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

  const handleCreate = () => {
    const name = draftName.trim();
    if (!name || isPending) return;
    createPlaylist.mutate(
      { name, tracks: [track] },
      {
        onSuccess: () => finishSuccess(`Created "${name}"`),
        onError: (err) => finishError("Couldn't create playlist", err),
      },
    );
  };

  const subtitle = `"${track.trackName}" · ${track.artistName}`;

  return (
    <AppSheet
      ref={sheetRef}
      background="card"
      enableDynamicSizing
      enablePanDownToClose
      stackBehavior="push"
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={handleDismiss}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          variant="title"
          style={[styles.title, { fontFamily: Fonts.semiBold }]}
        >
          Add to Playlist
        </Text>
        <Text
          variant="caption"
          numberOfLines={1}
          style={[styles.subtitle, { color: colors.subtle }]}
        >
          {subtitle}
        </Text>

        {playlists.length > 0 ? (
          <View style={[styles.list, { borderColor: colors.separator }]}>
            {playlists.map((playlist) => (
              <Pressable
                key={playlist.id}
                onPress={() => handlePick(playlist)}
                disabled={isPending}
                accessibilityLabel={`Add to ${playlist.name}`}
                style={({ pressed }) => [
                  styles.playlistRow,
                  { borderBottomColor: colors.separator },
                  { opacity: pressed || isPending ? 0.6 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.playlistIcon,
                    { backgroundColor: colors.brandMuted },
                  ]}
                >
                  <Ionicons
                    name="musical-notes"
                    size={16}
                    color={colors.brandStrong}
                  />
                </View>
                <View style={styles.playlistBody}>
                  <Text
                    variant="body"
                    numberOfLines={1}
                    style={{ fontFamily: Fonts.medium }}
                  >
                    {playlist.name}
                  </Text>
                  <Text variant="caption">
                    {playlist.trackCount === 1
                      ? "1 track"
                      : `${playlist.trackCount} tracks`}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text
          variant="caption"
          style={[styles.newLabel, { color: colors.subtle }]}
        >
          New Playlist
        </Text>
        <BottomSheetTextInput
          style={[inputBaseStyle, inputThemedStyle(colorScheme), styles.input]}
          placeholder="Playlist name"
          placeholderTextColor={colors.placeholder}
          value={draftName}
          onChangeText={setDraftName}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <Button
          title="Create and Add"
          onPress={handleCreate}
          loading={createPlaylist.isPending}
          disabled={!draftName.trim() || isPending}
        />
      </BottomSheetScrollView>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
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
  playlistIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistBody: {
    flex: 1,
    gap: 2,
  },
  newLabel: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    marginBottom: 12,
  },
});
