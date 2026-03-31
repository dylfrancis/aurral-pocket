import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  message: string;
};

export function EmptyState({
  icon = 'musical-notes-outline',
  message,
}: EmptyStateProps) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.subtle} />
      <Text variant="subtitle" style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  message: {
    textAlign: 'center',
  },
});
