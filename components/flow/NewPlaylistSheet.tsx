import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AppSheet, useSheet } from "@/components/ui/AppSheet";
import { Button } from "@/components/ui/Button";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { useCreateSharedPlaylist } from "@/hooks/flow/use-flow-mutations";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { SharedPlaylistTrack } from "@/lib/types/flow";

type Props = {
  track: SharedPlaylistTrack;
  subtitle: string;
  /** Once this sheet has gone, so the one underneath can close after it. */
  onCreated: (name: string) => void;
  onFailed: (err: unknown) => void;
  onDismiss: () => void;
};

/**
 * Mounts only while open, so each visit starts blank. Render it inside the
 * sheet it opens over: iOS presents a sheet over another only from its
 * content.
 */
export function NewPlaylistSheet({
  track,
  subtitle,
  onCreated,
  onFailed,
  onDismiss,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const sheet = useSheet({ presented: true, onClosed: onDismiss });
  const [name, setName] = useState("");
  const createPlaylist = useCreateSharedPlaylist();

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed || createPlaylist.isPending) return;
    createPlaylist.mutate(
      { name: trimmed, tracks: [track] },
      {
        onSuccess: () => sheet.close(() => onCreated(trimmed)),
        onError: onFailed,
      },
    );
  };

  return (
    <AppSheet sheet={sheet} background="card">
      <View style={styles.content}>
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
        <TextInput
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
      </View>
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
    ...Fonts.semiBold,
  },
  subtitle: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
});
