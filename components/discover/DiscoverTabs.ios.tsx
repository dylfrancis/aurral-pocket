import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Host } from "@expo/ui";
import { Button, HStack, ScrollView } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
  padding,
  scrollClipDisabled,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { HAS_LIQUID_GLASS } from "@/constants/navigation";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DISCOVER_TABS,
  type DiscoverTab,
  type DiscoverTabsProps,
} from "./discover-tabs";

const SYMBOLS: Record<
  DiscoverTab,
  NonNullable<ComponentProps<typeof Button>["systemImage"]>
> = {
  forYou: "sparkles",
  playlists: "music.note.list",
  trending: "chart.line.uptrend.xyaxis",
};

export function DiscoverTabs({ selected, onSelect }: DiscoverTabsProps) {
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
          {DISCOVER_TABS.map((tab) => {
            const isSelected = tab.id === selected;
            const variant = HAS_LIQUID_GLASS
              ? isSelected
                ? "glassProminent"
                : "glass"
              : isSelected
                ? "borderedProminent"
                : "bordered";
            return (
              <Button
                key={tab.id}
                label={tab.label}
                systemImage={SYMBOLS[tab.id]}
                onPress={() => {
                  if (isSelected) return;
                  void Haptics.selectionAsync();
                  onSelect(tab.id);
                }}
                modifiers={[
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
                ]}
              />
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
