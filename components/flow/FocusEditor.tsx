import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type Props = {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (next: string[]) => void;
};

export function FocusEditor({ label, placeholder, value, onChange }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [draft, setDraft] = useState("");

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setDraft("");
      return;
    }
    Haptics.selectionAsync();
    onChange([...value, trimmed]);
    setDraft("");
  };

  const remove = (entry: string) => {
    Haptics.selectionAsync();
    onChange(value.filter((item) => item !== entry));
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
      {value.length === 0 ? (
        <Text variant="caption">No filters added.</Text>
      ) : (
        <View style={styles.entries}>
          {value.map((entry) => (
            <Chip
              key={entry}
              label={entry}
              variant="brand"
              size="md"
              onRemove={() => remove(entry)}
            />
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
