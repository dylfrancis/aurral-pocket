import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

export function TrackMenuButton({
  trackName,
  onPress,
}: {
  trackName: string;
  onPress: () => void;
}) {
  const colors = Colors[useColorScheme()];

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
      <Ionicons name="ellipsis-horizontal" size={18} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingLeft: 4,
  },
});
