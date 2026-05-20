import { useCallback } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useBlocklistMutations,
  useIsArtistBlocked,
} from "@/hooks/discover/use-blocklist";
import { isValidMbid } from "@/lib/blocklist";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type BlockHeaderButtonProps = {
  mbid: string;
  artistName: string;
};

export function BlockHeaderButton({
  mbid,
  artistName,
}: BlockHeaderButtonProps) {
  const colors = Colors[useColorScheme()];
  const { blocked, loaded } = useIsArtistBlocked(mbid, artistName);
  const { toggleArtist, isPending } = useBlocklistMutations();

  const onConfirmBlock = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    toggleArtist({
      mbid: isValidMbid(mbid) ? mbid : null,
      name: artistName || null,
    });
  }, [toggleArtist, mbid, artistName]);

  const onPress = useCallback(() => {
    if (!loaded || isPending) return;
    if (blocked) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleArtist({
        mbid: isValidMbid(mbid) ? mbid : null,
        name: artistName || null,
      });
      return;
    }
    Alert.alert(
      `Block ${artistName}?`,
      "They'll be hidden from Discover, Flow, and nearby shows.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: onConfirmBlock },
      ],
    );
  }, [
    loaded,
    isPending,
    blocked,
    toggleArtist,
    mbid,
    artistName,
    onConfirmBlock,
  ]);

  const iconName: keyof typeof Ionicons.glyphMap = blocked
    ? "ban"
    : "ban-outline";
  const tint = !loaded ? colors.subtle : blocked ? colors.error : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!loaded || isPending}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={blocked ? "Unblock artist" : "Block artist"}
      style={({ pressed }) => [
        styles.button,
        (!loaded || isPending) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {isPending ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <Ionicons name={iconName} size={22} color={tint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 6,
  },
  pressed: {
    opacity: 0.5,
  },
  disabled: {
    opacity: 0.4,
  },
});
