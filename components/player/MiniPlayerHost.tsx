import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { HAS_LIQUID_GLASS } from "@/constants/navigation";
import { IS_IOS } from "@/constants/platform";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHasQueue } from "@/lib/player/player";

/** Classic UITabBar height on iOS 18 and earlier, in points. */
const LEGACY_TAB_BAR_HEIGHT = 49;
const DOCK_MARGIN = 8;
/** Fixed, so the host can reserve exactly this much layout space. */
const DOCK_HEIGHT = 56;

/**
 * Wraps one tab's stack so the mini player floats over every screen of that
 * tab. On iOS 26+ the tab bar's native bottom accessory hosts the bar
 * instead, and this wrapper passes children through untouched.
 */
export function MiniPlayerHost({ children }: { children: ReactNode }) {
  if (HAS_LIQUID_GLASS) {
    return <>{children}</>;
  }

  return <DockedHost>{children}</DockedHost>;
}

function DockedHost({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const hasQueue = useHasQueue();

  // Android's tab content area ends at the top of the tab bar, so the dock
  // sits at the content's bottom edge. On iOS 18 and earlier the content
  // extends under the translucent bar, so the dock clears the bar and the
  // home indicator.
  const dockBottom = IS_IOS
    ? insets.bottom + LEGACY_TAB_BAR_HEIGHT + DOCK_MARGIN
    : DOCK_MARGIN;

  return (
    <View
      style={[
        styles.host,
        // The dock is absolutely positioned, so the host reserves its zone
        // while it shows — screens must not render beneath it.
        hasQueue && {
          paddingBottom: dockBottom + DOCK_HEIGHT + DOCK_MARGIN,
        },
      ]}
    >
      {children}
      {hasQueue && <MiniPlayerDock bottom={dockBottom} />}
    </View>
  );
}

/**
 * The mini player for platforms without the native accessory: a themed card
 * docked above the tab bar, the way Material streaming apps draw it.
 */
function MiniPlayerDock({ bottom }: { bottom: number }) {
  const colors = Colors[useColorScheme()];

  return (
    <View
      style={[
        styles.dock,
        {
          bottom,
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.separator,
        },
      ]}
    >
      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  dock: {
    position: "absolute",
    left: DOCK_MARGIN,
    right: DOCK_MARGIN,
    height: DOCK_HEIGHT,
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
