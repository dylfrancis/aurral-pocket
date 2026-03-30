import {
  TextInput,
  type TextInputProps,
  StyleSheet,
} from 'react-native';
import { forwardRef } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

export const inputThemedStyle = (colorScheme: 'light' | 'dark') => {
  const colors = Colors[colorScheme];
  return {
    backgroundColor: colors.inputBackground,
    borderColor: colors.inputBorder,
    color: colors.inputText,
    fontFamily: Fonts.regular,
  } as const;
};

export const inputBaseStyle = StyleSheet.create({
  input: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
}).input;

export const Input = forwardRef<TextInput, TextInputProps>(function Input(
  { style, ...rest },
  ref,
) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <TextInput
      ref={ref}
      style={[inputBaseStyle, inputThemedStyle(colorScheme), style]}
      placeholderTextColor={colors.placeholder}
      autoCapitalize="none"
      autoCorrect={false}
      {...rest}
    />
  );
});
