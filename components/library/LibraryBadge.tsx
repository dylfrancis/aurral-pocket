import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

type LibraryBadgeProps = {
  onPress: () => void;
};

export function LibraryBadge({ onPress }: LibraryBadgeProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.badge,
        { backgroundColor: colors.brandMuted, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name="checkmark-circle" size={16} color={colors.brandStrong} />
      <Text variant="caption" style={[styles.label, { color: colors.brandStrong }]}>
        In Your Library
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.brandStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
});
