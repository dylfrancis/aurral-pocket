import { useCallback } from "react";
import { useRouter, useSegments, type Href } from "expo-router";
import { IS_ANDROID } from "@/constants/platform";

/**
 * Navigates to a route in one of the tabs. On Android, Activity, Settings and
 * the player sit above the tabs, and a navigate from there stacks a second
 * set of tabs, so it pops back down to them instead.
 */
export function useNavigateToTab() {
  const router = useRouter();
  const segments: string[] = useSegments();
  const aboveTabs = IS_ANDROID && segments[1] !== "(tabs)";

  return useCallback(
    (href: Href) =>
      aboveTabs ? router.dismissTo(href) : router.navigate(href),
    [aboveTabs, router],
  );
}
