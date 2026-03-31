import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

type MonitoredBadgeProps = {
  monitored: boolean;
};

export function MonitoredBadge({ monitored }: MonitoredBadgeProps) {
  const colors = Colors[useColorScheme()];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: monitored ? `${colors.brand}20` : colors.separator,
        },
      ]}
    >
      <Text
        variant="caption"
        style={[
          styles.label,
          { color: monitored ? colors.brand : colors.subtle },
        ]}
      >
        {monitored ? 'Monitored' : 'Unmonitored'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  label: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Fonts.medium,
  },
});
