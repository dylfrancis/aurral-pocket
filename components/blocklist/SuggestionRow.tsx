import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

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
  const colors = useColors();
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
