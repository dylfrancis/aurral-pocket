import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Host } from "@expo/ui";
import { FilterChip, Icon, Row, Text } from "@expo/ui/jetpack-compose";
import { horizontalScroll, padding } from "@expo/ui/jetpack-compose/modifiers";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { PillRowProps } from "./pill-row";

export function PillRow<Id extends string>({
  items,
  selected,
  onSelect,
}: PillRowProps<Id>) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];

  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme={scheme}
      style={styles.host}
    >
      <Row
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[horizontalScroll(), padding(16, 4, 16, 4)]}
      >
        {items.map((item) => {
          const isSelected = item.id === selected;
          const foreground = isSelected
            ? colors.buttonPrimaryText
            : colors.text;
          return (
            <FilterChip
              key={item.id}
              selected={isSelected}
              onClick={() => {
                if (isSelected) return;
                void Haptics.selectionAsync();
                onSelect(item.id);
              }}
              colors={{
                labelColor: colors.text,
                iconColor: colors.text,
                selectedContainerColor: colors.brand,
                selectedLabelColor: colors.buttonPrimaryText,
                selectedLeadingIconColor: colors.buttonPrimaryText,
              }}
              border={{ color: colors.separator }}
            >
              {item.androidIcon !== undefined ? (
                <FilterChip.LeadingIcon>
                  <Icon source={item.androidIcon} size={18} tint={foreground} />
                </FilterChip.LeadingIcon>
              ) : null}
              <FilterChip.Label>
                <Text color={foreground}>
                  {item.label}
                  {item.count !== undefined ? (
                    <Text color={isSelected ? foreground : colors.subtle}>
                      {` ${item.count}`}
                    </Text>
                  ) : null}
                </Text>
              </FilterChip.Label>
            </FilterChip>
          );
        })}
      </Row>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: "stretch",
  },
});
