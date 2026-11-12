// Stand-ins for the @expo/ui universal components the Settings pages use,
// for `jest.mock("@expo/ui", () => require("@/test-support/expo-ui"))`. Jest
// has no SwiftUI or Compose, so each renders the React Native view a test can
// query and press.
import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ReactNode,
} from "react";
import {
  Pressable,
  Text as RNText,
  TextInput as RNTextInput,
  View,
} from "react-native";

type Children = { children?: ReactNode };

export function Host({ children }: Children) {
  return <View>{children}</View>;
}

function Section({ title, children }: Children & { title?: string }) {
  return (
    <View>
      {title ? <RNText>{title}</RNText> : null}
      {children}
    </View>
  );
}

function Slot({ children }: Children) {
  return <View>{children}</View>;
}

export const FieldGroup = Object.assign(
  ({ children }: Children) => <View>{children}</View>,
  { Section, SectionHeader: Slot, SectionFooter: Slot },
);

export function Text({ children }: { children?: string }) {
  return <RNText>{children}</RNText>;
}

export function Row({ children }: Children) {
  return <View>{children}</View>;
}

export const Icon = Object.assign(() => null, {
  select: (spec: { ios: string }) => spec.ios,
});

type ListItemProps = Children & {
  onPress?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  supportingText?: ReactNode;
  testID?: string;
};

/** A row without `onPress` is inert, as the native one is. */
export function ListItem({
  children,
  onPress,
  leading,
  trailing,
  supportingText,
  testID,
}: ListItemProps) {
  const content = (
    <>
      {leading}
      {children}
      {typeof supportingText === "string" ? (
        <RNText>{supportingText}</RNText>
      ) : (
        supportingText
      )}
      {trailing}
    </>
  );
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    <View testID={testID}>{content}</View>
  );
}

type TextInputProps = {
  defaultValue?: string;
  placeholder?: string;
  accessibilityLabel?: string;
  editable?: boolean;
  secureTextEntry?: boolean;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: (text: string) => void;
};

/** Uncontrolled, like the native field, which keeps its own text. */
export const TextInput = forwardRef<{ clear: () => void }, TextInputProps>(
  function TextInput(
    { defaultValue, onChangeText, onSubmitEditing, ...props },
    ref,
  ) {
    const [value, setValue] = useState(defaultValue ?? "");
    useImperativeHandle(ref, () => ({ clear: () => setValue("") }));
    return (
      <RNTextInput
        {...props}
        value={value}
        onChangeText={(text) => {
          setValue(text);
          onChangeText?.(text);
        }}
        onSubmitEditing={() => onSubmitEditing?.(value)}
      />
    );
  },
);
