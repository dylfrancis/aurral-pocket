import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon = "musical-notes-outline",
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.subtle} />
      <Text variant="subtitle" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
    gap: 12,
  },
  message: {
    textAlign: "center",
    paddingHorizontal: 32,
  },
  button: {
    marginTop: 8,
    width: "auto",
    paddingHorizontal: 24,
  },
});
