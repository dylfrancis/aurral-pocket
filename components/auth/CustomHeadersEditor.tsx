import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import type { FieldErrors } from "react-hook-form";
import { Text } from "@/components/ui/Text";
import { Separator } from "@/components/ui/Separator";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { newHeaderRow, type HeaderRow } from "@/lib/custom-headers";

type HeaderFieldErrors = FieldErrors<{ headers: HeaderRow[] }>["headers"];

export function headerRowMessages(
  errors: HeaderFieldErrors,
  count: number,
): (string | undefined)[] {
  return Array.from(
    { length: count },
    (_, index) =>
      errors?.[index]?.name?.message ?? errors?.[index]?.value?.message,
  );
}

type Props = {
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
  errors?: (string | undefined)[];
  editable?: boolean;
};

/**
 * Only for use inside a bottom sheet: its inputs are the sheet's own, so the
 * keyboard keeps them in view.
 */
export function CustomHeadersEditor({
  rows,
  onChange,
  errors = [],
  editable = true,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const inputStyle = [inputBaseStyle, inputThemedStyle(colorScheme)];

  const updateRow = (id: string, patch: Partial<HeaderRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <View>
      {rows.map((row, index) => (
        <Fragment key={row.id}>
          {index > 0 ? <Separator style={styles.separator} /> : null}
          <View style={styles.row}>
            <View style={styles.fields}>
              <BottomSheetTextInput
                style={inputStyle}
                placeholder="Header name"
                placeholderTextColor={colors.placeholder}
                value={row.name}
                onChangeText={(name) => updateRow(row.id, { name })}
                autoCapitalize="none"
                autoCorrect={false}
                editable={editable}
                accessibilityLabel="Header name"
              />
              <BottomSheetTextInput
                style={inputStyle}
                placeholder="Value"
                placeholderTextColor={colors.placeholder}
                value={row.value}
                onChangeText={(value) => updateRow(row.id, { value })}
                secureTextEntry
                // A secure field would otherwise offer to save a password.
                textContentType="none"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect={false}
                editable={editable}
                accessibilityLabel={
                  row.name.trim() ? `Value for ${row.name.trim()}` : "Value"
                }
              />
            </View>
            <Pressable
              onPress={() => onChange(rows.filter(({ id }) => id !== row.id))}
              disabled={!editable}
              hitSlop={8}
              style={({ pressed }) => [
                styles.remove,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${row.name.trim() || "header"}`}
            >
              <Ionicons
                name="remove-circle-outline"
                size={22}
                color={colors.subtle}
              />
            </Pressable>
          </View>
          {errors[index] ? (
            <Text variant="error" style={styles.error}>
              {errors[index]}
            </Text>
          ) : null}
        </Fragment>
      ))}

      <Pressable
        onPress={() => onChange([...rows, newHeaderRow()])}
        disabled={!editable}
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={18} color={colors.brand} />
        <Text variant="body" style={{ color: colors.brand, ...Fonts.medium }}>
          Add Header
        </Text>
      </Pressable>
      <Text variant="caption" style={styles.hint}>
        Sent with every request to this server, never to other sites.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  fields: {
    flex: 1,
    gap: 8,
  },
  // The name field's height, so the button sits level with it.
  remove: {
    height: 50,
    justifyContent: "center",
  },
  separator: {
    marginVertical: 12,
  },
  error: {
    marginTop: 6,
  },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 10,
  },
  hint: {
    marginTop: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
