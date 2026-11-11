import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Host } from "@expo/ui";
import { FilterChip, Icon, Row, Text } from "@expo/ui/jetpack-compose";
import { horizontalScroll, padding } from "@expo/ui/jetpack-compose/modifiers";
import QueueMusic from "@expo/material-symbols/queue_music.xml";
import Stars from "@expo/material-symbols/stars.xml";
import ThumbUp from "@expo/material-symbols/thumb_up.xml";
import TrendingUp from "@expo/material-symbols/trending_up.xml";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DISCOVER_TABS,
  type DiscoverTab,
  type DiscoverTabsProps,
} from "./discover-tabs";

const ICONS: Record<DiscoverTab, number> = {
  forYou: Stars,
  recommended: ThumbUp,
  playlists: QueueMusic,
  trending: TrendingUp,
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
      <Row
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[horizontalScroll(), padding(16, 4, 16, 4)]}
      >
        {DISCOVER_TABS.map((tab) => {
          const isSelected = tab.id === selected;
          const foreground = isSelected
            ? colors.buttonPrimaryText
            : colors.text;
          return (
            <FilterChip
              key={tab.id}
              selected={isSelected}
              onClick={() => {
                if (isSelected) return;
                void Haptics.selectionAsync();
                onSelect(tab.id);
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
              <FilterChip.LeadingIcon>
                <Icon source={ICONS[tab.id]} size={18} tint={foreground} />
              </FilterChip.LeadingIcon>
              <FilterChip.Label>
                <Text color={foreground}>{tab.label}</Text>
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
