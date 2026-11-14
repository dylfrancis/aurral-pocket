import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CircleButton } from "@/components/ui/CircleButton";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

export const PLAY_ROW_HEIGHT = 50;

/** `children` must fill the third slot, or Play sits off center. */
export function PlayRow({
  title,
  disabled,
  onPlay,
  onShuffle,
  children,
}: {
  title: string;
  disabled?: boolean;
  onPlay: () => void;
  onShuffle: () => void;
  children: ReactNode;
}) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      <CircleButton
        icon="shuffle"
        size={PLAY_ROW_HEIGHT}
        accessibilityLabel={`Shuffle ${title}`}
        onPress={onShuffle}
        disabled={disabled}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onPlay}
        disabled={disabled}
        style={({ pressed }) => [
          styles.playButton,
          {
            backgroundColor: colors.brand,
            opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name="play" size={18} color={colors.buttonPrimaryText} />
        <Text
          variant="body"
          style={[styles.playLabel, { color: colors.buttonPrimaryText }]}
        >
          Play
        </Text>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: PLAY_ROW_HEIGHT * 3,
    height: PLAY_ROW_HEIGHT,
    borderRadius: PLAY_ROW_HEIGHT / 2,
    borderCurve: "continuous",
  },
  playLabel: {
    ...Fonts.semiBold,
  },
});
