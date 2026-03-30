import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/auth-context';
import { useLogout } from '@/hooks/use-logout';
import { useSession } from '@/hooks/use-session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function SettingsScreen() {
  const { user, serverUrl } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const logoutMutation = useLogout();

  useSession();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text variant="title" style={styles.welcome}>
        Welcome, {user?.username}
      </Text>
      <Text variant="caption" style={styles.info}>
        {serverUrl}
      </Text>
      <Text variant="caption" style={styles.info}>
        Role: {user?.role}
      </Text>

      <Button
        title="Sign Out"
        onPress={() => logoutMutation.mutate()}
        loading={logoutMutation.isPending}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  welcome: {
    marginBottom: 12,
  },
  info: {
    marginBottom: 4,
  },
  button: {
    marginTop: 32,
    width: 'auto',
    paddingHorizontal: 32,
  },
});
