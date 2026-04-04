import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

type ChipVariant = 'brand' | 'subtle' | 'error';

type ChipProps = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: ChipVariant;
};

export function Chip({ label, icon, variant = 'subtle' }: ChipProps) {
  const colors = Colors[useColorScheme()];

  const variantStyles: Record<ChipVariant, { bg: string; fg: string }> = {
    brand: { bg: colors.brandMuted, fg: colors.brandStrong },
    subtle: { bg: colors.separator, fg: colors.subtle },
    error: { bg: `${colors.error}20`, fg: colors.error },
  };

  const { bg, fg } = variantStyles[variant];

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={13} color={fg} />}
      <Text variant="caption" style={[styles.label, { color: fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.semiBold,
  },
});
