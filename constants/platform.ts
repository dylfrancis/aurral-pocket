import { Platform } from "react-native";

export const IS_IOS = Platform.OS === "ios";
export const IS_ANDROID = Platform.OS === "android";
export const KEYBOARD_AVOIDING_BEHAVIOR = IS_IOS
  ? "padding"
  : ("height" as const);
