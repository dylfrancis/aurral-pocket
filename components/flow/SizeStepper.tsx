import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { FLOW_SIZE_MAX, FLOW_SIZE_MIN, FLOW_SIZE_STEP } from "@/lib/types/flow";

type Props = {
  value: number;
  onChange: (value: number) => void;
};

export function SizeStepper({ value, onChange }: Props) {
  const colors = Colors[useColorScheme()];
  const decrement = () =>
    onChange(Math.max(FLOW_SIZE_MIN, value - FLOW_SIZE_STEP));
  const increment = () =>
    onChange(Math.min(FLOW_SIZE_MAX, value + FLOW_SIZE_STEP));

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
        },
      ]}
    >
      <Pressable
        onPress={decrement}
        disabled={value <= FLOW_SIZE_MIN}
        style={({ pressed }) => [
          styles.button,
          { opacity: pressed || value <= FLOW_SIZE_MIN ? 0.4 : 1 },
        ]}
        accessibilityLabel="Decrease size"
      >
        <Ionicons name="remove" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.valueWrap}>
        <Text
          variant="body"
          style={[
            styles.value,
            { color: colors.text, fontFamily: Fonts.semiBold },
          ]}
        >
          {value}
        </Text>
        <Text variant="caption">tracks</Text>
      </View>
      <Pressable
        onPress={increment}
        disabled={value >= FLOW_SIZE_MAX}
        style={({ pressed }) => [
          styles.button,
          { opacity: pressed || value >= FLOW_SIZE_MAX ? 0.4 : 1 },
        ]}
        accessibilityLabel="Increase size"
      >
        <Ionicons name="add" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 50,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  valueWrap: {
    alignItems: "center",
  },
  value: {
    fontSize: 18,
    lineHeight: 22,
  },
});
