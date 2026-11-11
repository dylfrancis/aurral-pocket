import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Host } from "@expo/ui";
import { Button, HStack, ScrollView, Text } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
  monospacedDigit,
  padding,
  scrollClipDisabled,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { HAS_LIQUID_GLASS } from "@/constants/navigation";
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
      <ScrollView
        axes="horizontal"
        showsIndicators={false}
        // Keeps the glass's edge light from being cut off at the row's ends.
        modifiers={[scrollClipDisabled()]}
      >
        <HStack
          spacing={8}
          modifiers={[padding({ horizontal: 16, vertical: 4 })]}
        >
          {items.map((item) => {
            const isSelected = item.id === selected;
            const variant = HAS_LIQUID_GLASS
              ? isSelected
                ? "glassProminent"
                : "glass"
              : isSelected
                ? "borderedProminent"
                : "bordered";
            const modifiers = [
              buttonStyle(variant),
              buttonBorderShape("capsule"),
              controlSize("regular"),
              ...(isSelected
                ? [
                    tint(colors.brand),
                    foregroundStyle(colors.buttonPrimaryText),
                    accessibilityAddTraits(["isSelected"]),
                  ]
                : [foregroundStyle(colors.text)]),
            ];
            const handlePress = () => {
              if (isSelected) return;
              void Haptics.selectionAsync();
              onSelect(item.id);
            };
            return item.count === undefined ? (
              <Button
                key={item.id}
                label={item.label}
                systemImage={item.systemImage}
                onPress={handlePress}
                modifiers={modifiers}
              />
            ) : (
              <Button key={item.id} onPress={handlePress} modifiers={modifiers}>
                <Text>
                  {`${item.label} `}
                  <Text
                    modifiers={[
                      foregroundStyle({
                        type: "hierarchical",
                        style: "secondary",
                      }),
                      monospacedDigit(),
                    ]}
                  >
                    {String(item.count)}
                  </Text>
                </Text>
              </Button>
            );
          })}
        </HStack>
      </ScrollView>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: "stretch",
  },
});
