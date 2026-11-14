import { initialWindowMetrics } from "react-native-safe-area-context";
import { isLiquidGlassAvailable } from "expo-glass-effect";

import { IS_IOS } from "@/constants/platform";

/**
 * Liquid Glass (iOS 26+) supplies translucent backings for headers and tab bars
 * automatically. On iOS 18 and earlier there is no glass, so those bars need an
 * explicit background or content scrolls under a bare bar.
 */
export const HAS_LIQUID_GLASS = IS_IOS && isLiquidGlassAvailable();

/**
 * On iOS, stack headers sit above native large-title behavior, so we let the
 * background show through. On iOS 26+ the Liquid Glass design supplies the
 * header backing automatically, but on iOS 18 and earlier a transparent header
 * has no blur or background — content scrolls under a bare bar. There we add a
 * native blur effect so large titles and search bars stay legible. On Android,
 * the header is opaque by default.
 */
const TRANSPARENT_HEADER = IS_IOS
  ? {
      headerTransparent: true,
      headerStyle: { backgroundColor: "transparent" },
      ...(HAS_LIQUID_GLASS
        ? {}
        : { headerBlurEffect: "systemChromeMaterial" as const }),
    }
  : {};

/**
 * Android inflates the header search view once per fragment and never
 * re-resolves its theme colors when `Appearance.setColorScheme` changes the
 * app theme (no activity recreation, so the cached view keeps the old
 * palette and can render invisible). Driving the colors from JS re-applies
 * them on every theme change. iOS re-themes natively; it uses `textColor`
 * and ignores the two Android-only props.
 */
export function searchBarColors(colors: { text: string; subtle: string }) {
  return {
    textColor: colors.text,
    hintTextColor: colors.subtle,
    headerIconColor: colors.text,
  } as const;
}

/** Placeholders for the search bars a layout declares ahead of its screen. */
export const SEARCH_PLACEHOLDERS = {
  artists: "Search artists...",
  albums: "Search albums and artists",
  genres: "Search genres",
  favorites: "Search favorites",
  blocklist: "Search for an artist",
  artistAlbums: "Search albums",
  artistReleases: "Search releases",
} as const;

/** The search bar a list screen keeps under its header. */
export function headerSearchBar(
  placeholder: string,
  colors: { text: string; subtle: string },
) {
  return {
    placeholder,
    hideWhenScrolling: false,
    autoCapitalize: "none",
    ...searchBarColors(colors),
  } as const;
}

/**
 * iOS sizes a pushed screen's header as the screen appears. A search bar that
 * joins after that, as one does on a screen still loading its data, collapses
 * the large title and can leave the list placed for the taller header, with
 * empty space above the first row. Declared in the layout, the bar is in the
 * header from the first frame, and the screen's own `Stack.SearchBar`, built
 * from the same `headerSearchBar`, replaces it in place with its handlers.
 * Android keeps search in the toolbar, so nothing moves, and swapping its
 * options can drop the search icon: there the screen's bar stands alone.
 */
export function layoutSearchBar(
  placeholder: string,
  colors: { text: string; subtle: string },
) {
  return IS_IOS
    ? { headerSearchBarOptions: headerSearchBar(placeholder, colors) }
    : {};
}

type ThemeColors = { background: string; text: string; subtle: string };

/** The screen options every tab's stack starts from. */
export function stackScreenOptions(colors: ThemeColors) {
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    ...TRANSPARENT_HEADER,
  };
}

/** A detail page that draws its own title in its content. */
export const DETAIL_SCREEN_OPTIONS = {
  headerTitle: "",
  headerBackButtonDisplayMode: "minimal",
} as const;

/**
 * An artist's Albums or Releases list, titled by the category it was opened
 * from.
 */
export function artistListScreenOptions(
  list: "albums" | "releases",
  colors: ThemeColors,
) {
  return ({ route }: { route: { params?: object } }) => ({
    title:
      (route.params as { title?: string } | undefined)?.title ??
      (list === "albums" ? "Albums" : "Releases"),
    headerLargeTitleEnabled: true,
    headerBackButtonDisplayMode: "minimal" as const,
    ...layoutSearchBar(
      list === "albums"
        ? SEARCH_PLACEHOLDERS.artistAlbums
        : SEARCH_PLACEHOLDERS.artistReleases,
      colors,
    ),
  });
}

/**
 * iOS 26+ Liquid Glass tab bars stay translucent at the scroll edge by design.
 * On iOS 18 and earlier that leaves the bar with no backing, so scrolled
 * content (e.g. artist artwork) bleeds into the tabs. Pinning the bar's
 * background at the scroll edge restores a solid tab bar there.
 */
export const TAB_BAR_BACKGROUND = HAS_LIQUID_GLASS
  ? {}
  : { disableTransparentOnScrollEdge: true };

/**
 * Not from useSafeAreaInsets: inside a tab that includes the tab bar and mini
 * player, which a sheet covers, so the sheet comes out with a tall empty gap.
 * This is the device's own inset.
 */
export const SHEET_BOTTOM_PADDING =
  (initialWindowMetrics?.insets.bottom ?? 0) + 16;
