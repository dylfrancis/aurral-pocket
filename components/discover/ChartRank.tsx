import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { describeMovement } from "@/lib/discover/trending-format";
import type { TrendingMovement } from "@/lib/types/search";

const CHART_RANK_WIDTH = 28;

type Props = {
  position: number;
  movement?: TrendingMovement;
};

export function ChartRank({ position, movement = null }: Props) {
  const colors = Colors[useColorScheme()];
  const movementLabel = describeMovement(movement);

  return (
    <View
      accessible
      accessibilityLabel={`No. ${position}${movementLabel ? `, ${movementLabel}` : ""}`}
      style={styles.column}
    >
      <Text
        variant="body"
        style={[styles.position, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {position}
      </Text>
      {movement === "new" ? (
        <Text style={[styles.movementText, { color: colors.brand }]}>NEW</Text>
      ) : movement ? (
        <View style={styles.movement}>
          <Ionicons
            name={movement > 0 ? "caret-up" : "caret-down"}
            size={9}
            color={movement > 0 ? colors.brand : colors.subtle}
          />
          <Text
            style={[
              styles.movementText,
              { color: movement > 0 ? colors.brand : colors.subtle },
            ]}
          >
            {Math.abs(movement)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: CHART_RANK_WIDTH,
    alignItems: "center",
  },
  position: {
    ...Fonts.semiBold,
    fontVariant: ["tabular-nums"],
  },
  movement: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  movementText: {
    ...Fonts.semiBold,
    fontSize: 10,
    lineHeight: 12,
    fontVariant: ["tabular-nums"],
  },
});
