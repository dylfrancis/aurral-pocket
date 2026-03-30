import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { useLogout } from '@/hooks/use-logout';
import { useSession } from '@/hooks/use-session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function HomeScreen() {
  const { user, serverUrl } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const logoutMutation = useLogout();

  // Validates the session on mount / when stale
  useSession();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.welcome, { color: colors.text }]}>
        Welcome, {user?.username}
      </Text>
      <Text style={[styles.info, { color: colors.subtle }]}>
        {serverUrl}
      </Text>
      <Text style={[styles.info, { color: colors.subtle }]}>
        Role: {user?.role}
      </Text>

      <Pressable
        style={[styles.button, { backgroundColor: colors.buttonPrimary }]}
        onPress={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
      >
        <Text style={[styles.buttonText, { color: colors.buttonPrimaryText }]}>
          Sign Out
        </Text>
      </Pressable>
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
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  info: {
    fontSize: 14,
    marginBottom: 4,
  },
  button: {
    marginTop: 32,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
