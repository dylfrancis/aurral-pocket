import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet } from "react-native";
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { AppSheet } from "@/components/ui/AppSheet";
import { Button } from "@/components/ui/Button";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { useCreateSharedPlaylist } from "@/hooks/flow/use-flow-mutations";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { SHEET_BOTTOM_PADDING } from "@/constants/navigation";
import { Colors, Fonts } from "@/constants/theme";
import type { SharedPlaylistTrack } from "@/lib/types/flow";

type Props = {
  track: SharedPlaylistTrack;
  subtitle: string;
  /** The sheet closes itself first, so the one underneath can go with it. */
  onCreated: (name: string) => void;
  onFailed: (err: unknown) => void;
  onDismiss: () => void;
};

/** Mounts only while open, so each visit starts blank. */
export function NewPlaylistSheet({
  track,
  subtitle,
  onCreated,
  onFailed,
  onDismiss,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const sheetRef = useRef<BottomSheetModal>(null);
  const [name, setName] = useState("");
  const createPlaylist = useCreateSharedPlaylist();

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
    onDismiss();
  }, [onDismiss]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed || createPlaylist.isPending) return;
    createPlaylist.mutate(
      { name: trimmed, tracks: [track] },
      {
        onSuccess: () => {
          sheetRef.current?.dismiss();
          onCreated(trimmed);
        },
        onError: onFailed,
      },
    );
  };

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
      <BottomSheetView
        style={[styles.content, { paddingBottom: SHEET_BOTTOM_PADDING }]}
      >
        <Text variant="title" style={styles.title}>
          New Playlist
        </Text>
        <Text
          variant="caption"
          numberOfLines={1}
          style={[styles.subtitle, { color: colors.subtle }]}
        >
          {subtitle}
        </Text>
        <BottomSheetTextInput
          style={[inputBaseStyle, inputThemedStyle(colorScheme), styles.input]}
          placeholder="Playlist name"
          placeholderTextColor={colors.placeholder}
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <Button
          title="Create and Add"
          onPress={handleCreate}
          loading={createPlaylist.isPending}
          disabled={!name.trim() || createPlaylist.isPending}
        />
      </BottomSheetView>
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
    ...Fonts.semiBold,
  },
  subtitle: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
});
