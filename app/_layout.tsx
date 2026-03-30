import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { serverUrl, token, isRestoring, serverHealth } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (isRestoring) return;

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    const isAuthenticated = !!serverUrl && !!token;
    const hasServer = !!serverUrl;

    if (isAuthenticated && !inAppGroup) {
      // Logged in but not in app — go to app
      router.replace('/(app)' as any);
    } else if (hasServer && !token && serverHealth?.authRequired !== false && !inAuthGroup) {
      // Has server, needs login, not in auth group
      router.replace('/(auth)/login' as any);
    } else if (hasServer && !token && serverHealth?.authRequired !== false && inAuthGroup && segments[1] !== 'login') {
      // Has server, needs login, in auth group but on connect screen
      router.replace('/(auth)/login' as any);
    } else if (!hasServer && !inAuthGroup) {
      // No server — go to connect
      router.replace('/(auth)/connect' as any);
    } else if (!hasServer && inAuthGroup && segments[1] !== 'connect') {
      // No server but on login screen — go to connect
      router.replace('/(auth)/connect' as any);
    }
  }, [isRestoring, serverUrl, token, serverHealth, segments, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Slot />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  );
}
