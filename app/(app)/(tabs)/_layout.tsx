import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { TAB_BAR_BACKGROUND } from "@/constants/navigation";
import { Colors, Fonts } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
  const { isUserResolved } = useAuth();
  const hasPermission = useHasPermission();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  // The tab set must be final on first render. A trigger whose `hidden` flag
  // flips after mount rebuilds the native tab bar, and on Android that
  // re-races the activity options menu that hosts the header search icon.
  if (!isUserResolved) {
    return <ScreenCenter loading />;
  }

  return (
    <NativeTabs
      tintColor={colors.tabIconSelected}
      backgroundColor={colors.card}
      indicatorColor={colors.brandMuted}
      labelStyle={{ ...Fonts.medium, color: colors.tabIconDefault }}
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
        <NativeTabs.Trigger.Icon sf="waveform" md="graphic_eq" />
        <NativeTabs.Trigger.Label>Playlists</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(activity)">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "clock.arrow.circlepath",
            selected: "clock.arrow.circlepath",
          }}
          md="update"
        />
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
