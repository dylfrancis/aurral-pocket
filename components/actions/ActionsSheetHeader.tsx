import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

export const HEADER_ART_SIZE = 56;

/** The top of an album or artist sheet: its art, its name, and a line under. */
export function ActionsSheetHeader({
  art,
  title,
  subtitle,
}: {
  art: ReactNode;
  title: string;
  subtitle?: string | null;
}) {
  return (
    <View style={styles.header}>
      {art}
      <View style={styles.headerText}>
        <Text variant="body" numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Play and Shuffle side by side, as the sheet's first actions. */
export function PlayShuffleButtons({
  title,
  onPlay,
  onShuffle,
}: {
  title: string;
  onPlay: () => void;
  onShuffle: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.buttons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play ${title}`}
        onPress={onPlay}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons name="play" size={18} color={colors.buttonPrimaryText} />
        <Text
          variant="body"
          style={[styles.buttonLabel, { color: colors.buttonPrimaryText }]}
        >
          Play
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Shuffle ${title}`}
        onPress={onShuffle}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.separator, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons name="shuffle" size={18} color={colors.text} />
        <Text variant="body" style={styles.buttonLabel}>
          Shuffle
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    ...Fonts.semiBold,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 8,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderCurve: "continuous",
  },
  buttonLabel: {
    ...Fonts.semiBold,
  },
});
