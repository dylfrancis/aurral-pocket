import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { Colors } from "@/constants/theme";
import { useThemePreference } from "@/contexts/theme-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ThemePreference } from "@/lib/types/theme";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "system", label: "System", icon: "phone-portrait-outline" },
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

export function AppearanceSection() {
  const colors = Colors[useColorScheme()];
  const { preference, setPreference } = useThemePreference();

  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => (
        <SettingsRow
          key={option.value}
          icon={option.icon}
          label={option.label}
          onPress={() => setPreference(option.value)}
          trailing={
            preference === option.value ? (
              <Ionicons name="checkmark" size={20} color={colors.brand} />
            ) : null
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
});
