import { ScrollView, StyleSheet, Pressable } from "react-native";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { SECONDARY_TYPES } from "@/hooks/library/use-release-type-filter";

type SecondaryTypeFilterProps = {
  selected: Set<string>;
  onToggle: (type: string) => void;
};

export function SecondaryTypeFilter({
  selected,
  onToggle,
}: SecondaryTypeFilterProps) {
  const colors = Colors[useColorScheme()];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {SECONDARY_TYPES.map((type) => {
        const active = selected.has(type);
        return (
          <Pressable
            key={type}
            onPress={() => onToggle(type)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.brandMuted : colors.separator,
                borderColor: active ? colors.brand : "transparent",
              },
            ]}
          >
            <Text
              variant="caption"
              style={[
                styles.label,
                { color: active ? colors.brandStrong : colors.subtle },
              ]}
            >
              {type}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
});
