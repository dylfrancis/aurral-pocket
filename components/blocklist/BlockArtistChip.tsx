import { useCallback } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useBlocklistMutations,
  useIsArtistBlocked,
} from "@/hooks/discover/use-blocklist";
import { isValidMbid } from "@/lib/blocklist";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type BlockArtistChipProps = {
  mbid: string;
  artistName: string;
};

export function BlockArtistChip({ mbid, artistName }: BlockArtistChipProps) {
  const colors = Colors[useColorScheme()];
  const { blocked, loaded } = useIsArtistBlocked(mbid, artistName);
  const { toggleArtist, isPending } = useBlocklistMutations();

  const doToggle = useCallback(() => {
    toggleArtist({
      mbid: isValidMbid(mbid) ? mbid : null,
      name: artistName || null,
    });
  }, [toggleArtist, mbid, artistName]);

  const onPress = useCallback(() => {
    if (!loaded || isPending) return;
    if (blocked) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      doToggle();
      return;
    }
    Alert.alert(
      `Block ${artistName}?`,
      "They'll be hidden from Discover, Flow, and nearby shows.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            );
            doToggle();
          },
        },
      ],
    );
  }, [loaded, isPending, blocked, artistName, doToggle]);

  const iconName: keyof typeof Ionicons.glyphMap = blocked
    ? "ban"
    : "ban-outline";
  const tint = !loaded ? colors.subtle : blocked ? colors.error : colors.brand;
  const label = blocked ? "Unblock artist" : "Block artist";

  return (
    <Pressable
      onPress={onPress}
      disabled={!loaded || isPending}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: colors.card },
        (!loaded || isPending) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {isPending ? (
        <ActivityIndicator size={16} color={tint} />
      ) : (
        <Ionicons name={iconName} size={18} color={tint} />
      )}
      <Text variant="caption" style={{ color: colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
