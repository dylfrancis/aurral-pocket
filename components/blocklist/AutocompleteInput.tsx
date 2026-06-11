import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type AutocompleteInputProps<T> = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  suggestions: T[];
  isLoading: boolean;
  renderSuggestion: (item: T) => ReactNode;
  onSelectSuggestion: (item: T) => void;
  keyExtractor: (item: T) => string;
  isItemDisabled?: (item: T) => boolean;
  onSubmit?: () => void;
  returnKeyType?: "done" | "search" | "go";
};

export function AutocompleteInput<T>({
  value,
  onChangeText,
  placeholder,
  suggestions,
  isLoading,
  renderSuggestion,
  onSelectSuggestion,
  keyExtractor,
  isItemDisabled,
  onSubmit,
  returnKeyType = "done",
}: AutocompleteInputProps<T>) {
  const colors = Colors[useColorScheme()];
  const showDropdown = value.trim().length >= 2 && suggestions.length > 0;

  return (
    <View>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.inputBorder,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.placeholder} />
        <TextInput
          style={[
            styles.input,
            { color: colors.inputText, fontFamily: Fonts.regular },
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          value={value}
          onChangeText={onChangeText}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmit}
        />
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.subtle} />
        ) : value.length > 0 ? (
          <Pressable onPress={() => onChangeText("")} hitSlop={8}>
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.placeholder}
            />
          </Pressable>
        ) : null}
      </View>

      {showDropdown ? (
        <Card bordered radius={10} style={styles.dropdown}>
          {suggestions.map((item) => {
            const disabled = isItemDisabled?.(item) ?? false;
            return (
              <Pressable
                key={keyExtractor(item)}
                onPress={() => {
                  if (!disabled) onSelectSuggestion(item);
                }}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.suggestion,
                  pressed &&
                    !disabled && { backgroundColor: colors.brandMuted },
                ]}
              >
                {renderSuggestion(item)}
              </Pressable>
            );
          })}
        </Card>
      ) : null}
    </View>
  );
}

type SuggestionRowProps = {
  primary: string;
  secondary?: string;
  trailing?: ReactNode;
  disabled?: boolean;
};

export function SuggestionRow({
  primary,
  secondary,
  trailing,
  disabled,
}: SuggestionRowProps) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={styles.row}>
      <View style={styles.rowLabels}>
        <Text
          variant="body"
          numberOfLines={1}
          style={{
            color: disabled ? colors.subtle : colors.text,
            fontFamily: Fonts.medium,
          }}
        >
          {primary}
        </Text>
        {secondary ? (
          <Text variant="caption" numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  dropdown: {
    marginTop: 6,
    overflow: "hidden",
  },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabels: {
    flex: 1,
    gap: 2,
  },
});
