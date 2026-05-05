import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { FLOW_SIZE_MAX, FLOW_SIZE_MIN, FLOW_SIZE_STEP } from "@/lib/types/flow";

type Props = {
  value: number;
  onChange: (value: number) => void;
};

function clamp(next: number): number {
  if (!Number.isFinite(next)) return FLOW_SIZE_MIN;
  return Math.max(FLOW_SIZE_MIN, Math.min(FLOW_SIZE_MAX, Math.round(next)));
}

export function SizeStepper({ value, onChange }: Props) {
  const colors = Colors[useColorScheme()];
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const decrement = () => {
    if (value <= FLOW_SIZE_MIN) return;
    Haptics.selectionAsync();
    onChange(Math.max(FLOW_SIZE_MIN, value - FLOW_SIZE_STEP));
  };
  const increment = () => {
    if (value >= FLOW_SIZE_MAX) return;
    Haptics.selectionAsync();
    onChange(Math.min(FLOW_SIZE_MAX, value + FLOW_SIZE_STEP));
  };

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(parsed) || draft.trim() === "") {
      setDraft(String(value));
      return;
    }
    const next = clamp(parsed);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
        },
      ]}
    >
      <Pressable
        onPress={decrement}
        disabled={value <= FLOW_SIZE_MIN}
        style={({ pressed }) => [
          styles.button,
          { opacity: pressed || value <= FLOW_SIZE_MIN ? 0.4 : 1 },
        ]}
        accessibilityLabel="Decrease size"
      >
        <Ionicons name="remove" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.valueWrap}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onFocus={() => setEditing(true)}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={3}
          selectTextOnFocus
          style={[
            styles.value,
            { color: colors.text, fontFamily: Fonts.semiBold },
          ]}
          accessibilityLabel="Track count"
        />
        <Text variant="caption">tracks</Text>
      </View>
      <Pressable
        onPress={increment}
        disabled={value >= FLOW_SIZE_MAX}
        style={({ pressed }) => [
          styles.button,
          { opacity: pressed || value >= FLOW_SIZE_MAX ? 0.4 : 1 },
        ]}
        accessibilityLabel="Increase size"
      >
        <Ionicons name="add" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 50,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  valueWrap: {
    alignItems: "center",
    minWidth: 80,
  },
  value: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: "center",
    minWidth: 60,
    paddingVertical: 0,
  },
});
