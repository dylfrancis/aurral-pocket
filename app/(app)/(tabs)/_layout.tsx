import { TAB_BAR_BACKGROUND } from "@/constants/navigation";
import { Colors, Fonts } from "@/constants/theme";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
  const hasPermission = useHasPermission();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <NativeTabs
      tintColor={colors.tabIconSelected}
      backgroundColor={colors.card}
      indicatorColor={colors.brandMuted}
      labelStyle={{ fontFamily: Fonts.medium, color: colors.tabIconDefault }}
      {...TAB_BAR_BACKGROUND}
    >
      <NativeTabs.Trigger name="(discover)">
        <NativeTabs.Trigger.Icon sf="sparkles" md="explore" />
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(library)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "books.vertical", selected: "books.vertical.fill" }}
          md="library_books"
        />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(search)" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(flow)" hidden={!hasPermission("accessFlow")}>
        <NativeTabs.Trigger.Icon sf="scribble" md="gesture" />
        <NativeTabs.Trigger.Label>Flow</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(requests)">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "clock.arrow.circlepath",
            selected: "clock.arrow.circlepath",
          }}
          md="update"
        />
        <NativeTabs.Trigger.Label>Requests</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
