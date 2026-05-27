import { isLiquidGlassAvailable } from "expo-glass-effect";

import { IS_IOS } from "@/constants/platform";

/**
 * On iOS, stack headers sit above native large-title behavior, so we let the
 * background show through. On iOS 26+ the Liquid Glass design supplies the
 * header backing automatically, but on iOS 18 and earlier a transparent header
 * has no blur or background — content scrolls under a bare bar. There we add a
 * native blur effect so large titles and search bars stay legible. On Android,
 * the header is opaque by default.
 */
export const TRANSPARENT_HEADER = IS_IOS
  ? {
      headerTransparent: true,
      headerStyle: { backgroundColor: "transparent" },
      ...(isLiquidGlassAvailable()
        ? {}
        : { headerBlurEffect: "systemChromeMaterial" as const }),
    }
  : {};
