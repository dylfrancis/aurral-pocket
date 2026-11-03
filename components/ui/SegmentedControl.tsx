import NativeSegmentedControl, {
  type SegmentedControlProps,
} from "@react-native-segmented-control/segmented-control";
import type { ComponentType } from "react";

/**
 * The native segmented control, retyped. 2.5.7's class extends React Native's
 * `NativeMethods`, which 0.87 removed, so its own typings no longer form a JSX
 * component. Import it from here until the package ships fixed typings.
 */
export const SegmentedControl =
  NativeSegmentedControl as unknown as ComponentType<SegmentedControlProps>;
