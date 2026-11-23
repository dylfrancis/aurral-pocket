import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

const ICON_SIZE = 18;
const LEADING_SPACE = 4;

/** The room the button takes in a row, for rows that hold it empty. */
export const TRACK_MENU_BUTTON_WIDTH = LEADING_SPACE + ICON_SIZE;

export function TrackMenuButton({
  trackName,
  onPress,
}: {
  trackName: string;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      // Track rows can be only 40pt tall, so the button borrows the space
      // around it to reach a tappable size.
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`More actions for ${trackName}`}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons
        name="ellipsis-horizontal"
        size={ICON_SIZE}
        color={colors.subtle}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingLeft: LEADING_SPACE,
  },
});
