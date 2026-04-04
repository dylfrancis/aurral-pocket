import { Stack } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';

export default function AuthLayout() {
  const { serverUrl, serverHealth } = useAuth();
  const hasServer = !!serverUrl;
  const needsLogin = hasServer && serverHealth?.authRequired !== false;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      {/* Get Started — visible when no server configured */}
      <Stack.Protected guard={!hasServer}>
        <Stack.Screen
          name="get-started"
          options={{
            animation: 'slide_from_left',
          }}
        />
      </Stack.Protected>

      {/* Login screen — visible when server is set but needs auth */}
      <Stack.Protected guard={needsLogin}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
