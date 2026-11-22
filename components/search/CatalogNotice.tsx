import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

/**
 * Says the metadata server didn't answer, above results that then come only
 * from the Library.
 */
export function CatalogNotice({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.subtle} />
      <Text
        variant="caption"
        style={[styles.message, { color: colors.subtle }]}
      >
        The catalog didn’t answer, so only your Library shows.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text
          variant="caption"
          style={[styles.action, { color: colors.brand }]}
        >
          Try Again
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  message: {
    flex: 1,
  },
  action: {
    ...Fonts.semiBold,
  },
});
