import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

export default function TabsLayout() {
  const hasPermission = useHasPermission();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  return (
    <NativeTabs
      tintColor={colors.tabIconSelected}
      backgroundColor={colors.card}
      indicatorColor={`${colors.brand}33`}
      labelStyle={{ fontFamily: Fonts.medium, color: colors.tabIconDefault }}
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

      <NativeTabs.Trigger
        name="(settings)"
        hidden={!hasPermission("accessSettings")}
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
