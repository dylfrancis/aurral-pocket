// Stand-ins for expo-router's Stack header pieces, for a screen rendered with
// no navigator: `jest.mock("expo-router", () => ({ ...require("@/test-support/expo-router-stack"), useRouter: ... }))`.
// The native header renders nothing under Jest, so each menu action renders
// as a pressable named by its title, carrying whether it's on or can be
// picked, and a menu as a group named by its accessibility label.
import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { isMenuActionOn } from "./menu-action";

function MenuAction({
  children,
  isOn,
  icon,
  disabled,
  onPress,
}: {
  children: string;
  isOn?: boolean;
  icon?: unknown;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={children}
      accessibilityState={{
        checked: isMenuActionOn({ isOn, icon }),
        disabled: !!disabled,
      }}
      onPress={disabled ? undefined : onPress}
    >
      <Text>{children}</Text>
    </Pressable>
  );
}

function Menu({
  children,
  accessibilityLabel,
}: {
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  return <View accessibilityLabel={accessibilityLabel}>{children}</View>;
}

function Passthrough({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/** A text field named by its placeholder, reporting typing as the native bar does. */
function SearchBar({
  placeholder,
  onChangeText,
}: {
  placeholder?: string;
  onChangeText?: (event: { nativeEvent: { text: string } }) => void;
}) {
  return (
    <TextInput
      accessibilityLabel={placeholder}
      onChangeText={(text) => onChangeText?.({ nativeEvent: { text } })}
    />
  );
}

export const Stack = {
  Screen: () => null,
  SearchBar,
  Toolbar: Object.assign(Passthrough, {
    Menu,
    MenuAction,
    Button: () => null,
    Badge: () => null,
  }),
};
