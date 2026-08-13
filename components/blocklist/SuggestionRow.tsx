import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type SuggestionRowProps = {
  primary: string;
  secondary?: string;
  trailing?: ReactNode;
  disabled?: boolean;
};

export function SuggestionRow({
  primary,
  secondary,
  trailing,
  disabled,
}: SuggestionRowProps) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={styles.row}>
      <View style={styles.rowLabels}>
        <Text
          variant="body"
          numberOfLines={1}
          style={{
            color: disabled ? colors.subtle : colors.text,
            ...Fonts.medium,
          }}
        >
          {primary}
        </Text>
        {secondary ? (
          <Text variant="caption" numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabels: {
    flex: 1,
    gap: 2,
  },
});
