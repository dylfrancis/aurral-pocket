import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Padding that keeps content clear of the left and right safe areas, such as
 * the iPhone Duo's side rail. Stack screens already get it from their layout.
 */
export function useSidePadding() {
  const { left, right } = useSafeAreaInsets();
  return { paddingLeft: left, paddingRight: right };
}

/**
 * The width beside the side safe areas. Read it at render, never once at
 * import: it changes as the phone folds or rotates, and in Split View.
 */
export function useContentWidth() {
  const { width } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();
  return width - left - right;
}
