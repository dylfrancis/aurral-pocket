import { isLiquidGlassAvailable } from "expo-glass-effect";

import { IS_IOS } from "@/constants/platform";

/**
 * Liquid Glass (iOS 26+) supplies translucent backings for headers and tab bars
 * automatically. On iOS 18 and earlier there is no glass, so those bars need an
 * explicit background or content scrolls under a bare bar.
 */
const HAS_LIQUID_GLASS = IS_IOS && isLiquidGlassAvailable();

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
      ...(HAS_LIQUID_GLASS
        ? {}
        : { headerBlurEffect: "systemChromeMaterial" as const }),
    }
  : {};

/**
 * iOS 26+ Liquid Glass tab bars stay translucent at the scroll edge by design.
 * On iOS 18 and earlier that leaves the bar with no backing, so scrolled
 * content (e.g. artist artwork) bleeds into the tabs. Pinning the bar's
 * background at the scroll edge restores a solid tab bar there.
 */
export const TAB_BAR_BACKGROUND = HAS_LIQUID_GLASS
  ? {}
  : { disableTransparentOnScrollEdge: true };
