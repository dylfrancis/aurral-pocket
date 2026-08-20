import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { FLOW_YEAR_MAX } from "@/lib/types/flow";

const YEAR_DIGITS = String(FLOW_YEAR_MAX).length;

type Props = {
  label: string;
  placeholder: string;
  testID?: string;
  value: number | null;
  onChange: (next: number | null) => void;
};

/**
 * One end of a flow's release-year range. An empty field is an open bound,
 * which the form sends to Aurral as null.
 */
export function YearBoundInput({
  label,
  placeholder,
  testID,
  value,
  onChange,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  // Every keystroke updates the form. A commit on blur would race the Save
  // button, which can read the form before the blur lands.
  const handleChangeText = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "");
    onChange(digits === "" ? null : Number(digits));
  };

  return (
    <View style={styles.wrap}>
      <Text variant="caption" style={{ color: colors.subtle, ...Fonts.medium }}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        style={[inputBaseStyle, inputThemedStyle(colorScheme), styles.input]}
        value={value == null ? "" : String(value)}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType="number-pad"
        maxLength={YEAR_DIGITS}
        returnKeyType="done"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: 6,
  },
  input: {
    textAlign: "center",
  },
});
