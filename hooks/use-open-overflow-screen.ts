import { useCallback } from "react";
import { useNavigation, useRouter, type Href } from "expo-router";
import { IS_IOS } from "@/constants/platform";

export type OverflowScreen = "activity" | "settings";

const TAB_HREFS: Record<OverflowScreen, Href> = {
  activity: "/(app)/(tabs)/(activity)/queue",
  settings: "/(app)/(tabs)/(settings)/settings",
};

/**
 * Opens Activity or Settings: a tab on iOS, a screen above the tabs on
 * Android. Both route trees answer the same paths, and a group in a path is
 * only a preference, so from a tab even a path naming Android's groups lands
 * on the hidden tab copy, which redirects to Discover. Android pushes onto the
 * stack above the tabs by name instead.
 */
export function useOpenOverflowScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  return useCallback(
    (screen: OverflowScreen) => {
      if (IS_IOS) router.navigate(TAB_HREFS[screen]);
      else navigation.getParent("/(app)")?.navigate(`(${screen})` as never);
    },
    [router, navigation],
  );
}
