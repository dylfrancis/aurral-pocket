import { Platform, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { isShazamAvailable } from "@/modules/shazam";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type Props = {
  onPress: () => void;
};

/**
 * Header button that opens the Shazam listening sheet. Renders nothing when the
 * native module isn't linked (web / Expo Go).
 */
export function ShazamTriggerButton({ onPress }: Props) {
  const colors = Colors[useColorScheme()];

  if (!isShazamAvailable || Platform.OS === "web") return null;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityLabel="Identify song"
      hitSlop={8}
    >
      <Ionicons name="mic-outline" size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
