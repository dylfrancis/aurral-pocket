import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

export type SortMode = 'alpha' | 'recent' | 'albums';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  showSort?: boolean;
};

const sortOptions: { key: SortMode; label: string }[] = [
  { key: 'alpha', label: 'A-Z' },
  { key: 'recent', label: 'Recent' },
  { key: 'albums', label: 'Albums' },
];

export function SearchBar({
  value,
  onChangeText,
  sortMode,
  onSortChange,
  showSort = true,
}: SearchBarProps) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
        <Ionicons name="search" size={18} color={colors.placeholder} />
        <TextInput
          style={[styles.input, { color: colors.inputText, fontFamily: Fonts.regular }]}
          placeholder="Search artists..."
          placeholderTextColor={colors.placeholder}
          value={value}
          onChangeText={onChangeText}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChangeText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.placeholder} />
          </Pressable>
        )}
      </View>
      {showSort && <View style={styles.sortRow}>
        {sortOptions.map((option) => {
          const active = sortMode === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onSortChange(option.key)}
              style={[
                styles.sortPill,
                {
                  backgroundColor: active ? `${colors.brand}20` : colors.card,
                  borderColor: active ? colors.brand : colors.separator,
                },
              ]}
            >
              <Text
                variant="caption"
                style={[
                  styles.sortLabel,
                  { color: active ? colors.brand : colors.subtle },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  sortLabel: {
    fontFamily: Fonts.medium,
  },
});
