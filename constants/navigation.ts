import { IS_IOS } from "@/constants/platform";

/**
 * On iOS, stack headers sit above native blur + large-title behavior, so we
 * let the background show through. On Android, the header is opaque by
 * default.
 */
export const TRANSPARENT_HEADER = IS_IOS
  ? { headerTransparent: true, headerStyle: { backgroundColor: "transparent" } }
  : {};
