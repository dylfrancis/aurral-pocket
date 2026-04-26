import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { FocusStrength } from "@/lib/types/flow";

const STRENGTHS: { value: FocusStrength; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];

type Props = {
  label: string;
  placeholder: string;
  value: Record<string, FocusStrength>;
  onChange: (next: Record<string, FocusStrength>) => void;
};

export function FocusEditor({ label, placeholder, value, onChange }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [draft, setDraft] = useState("");

  const entries = Object.entries(value);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value[trimmed]) {
      setDraft("");
      return;
    }
    onChange({ ...value, [trimmed]: "medium" });
    setDraft("");
  };

  const remove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const setStrength = (key: string, strength: FocusStrength) => {
    onChange({ ...value, [key]: strength });
  };

  return (
    <View style={styles.wrap}>
      <Text variant="body" style={{ fontFamily: Fonts.medium }}>
        {label}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[inputBaseStyle, inputThemedStyle(colorScheme), styles.input]}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim()}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.brand,
              opacity: pressed || !draft.trim() ? 0.4 : 1,
            },
          ]}
          accessibilityLabel={`Add ${label}`}
        >
          <Ionicons name="add" size={20} color={colors.buttonPrimaryText} />
        </Pressable>
      </View>
      {entries.length === 0 ? (
        <Text variant="caption">No filters added.</Text>
      ) : (
        <View style={styles.entries}>
          {entries.map(([key, strength]) => (
            <View
              key={key}
              style={[
                styles.entry,
                {
                  backgroundColor: colors.brandMuted,
                  borderColor: colors.separator,
                },
              ]}
            >
              <View style={styles.entryHead}>
                <Text
                  variant="body"
                  style={{ color: colors.text, fontFamily: Fonts.semiBold }}
                  numberOfLines={1}
                >
                  {key}
                </Text>
                <Pressable
                  onPress={() => remove(key)}
                  style={({ pressed }) => [
                    styles.removeButton,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                  accessibilityLabel={`Remove ${key}`}
                >
                  <Ionicons name="close" size={16} color={colors.subtle} />
                </Pressable>
              </View>
              <View style={styles.strengthRow}>
                {STRENGTHS.map((option) => {
                  const active = option.value === strength;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setStrength(key, option.value)}
                      style={({ pressed }) => [
                        styles.strengthChip,
                        {
                          backgroundColor: active
                            ? colors.brand
                            : colors.surfaceElevated,
                          borderColor: active ? colors.brand : colors.separator,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: active
                            ? colors.buttonPrimaryText
                            : colors.text,
                          fontFamily: Fonts.semiBold,
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  entries: {
    gap: 8,
  },
  entry: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  entryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  removeButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  strengthRow: {
    flexDirection: "row",
    gap: 6,
  },
  strengthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
