import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type Option<T extends string | number> = {
  value: T;
  label: string;
};

type Props<T extends string | number> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function SegmentedRow<T extends string | number>({
  value,
  options,
  onChange,
}: Props<T>) {
  const colors = Colors[useColorScheme()];

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
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: active ? colors.brand : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              variant="body"
              style={{
                color: active ? colors.buttonPrimaryText : colors.text,
                fontFamily: Fonts.semiBold,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
