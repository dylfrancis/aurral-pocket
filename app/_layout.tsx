import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Theme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
} from '@expo-google-fonts/dm-sans/400Regular';
import {
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans/500Medium';
import {
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans/600SemiBold';
import {
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans/700Bold';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

const AurralDarkTheme: Theme = {
  dark: true,
  colors: {
    primary: Colors.dark.brand,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.separator,
    notification: Colors.dark.error,
  },
  fonts: {
    regular: { fontFamily: 'DMSans_400Regular', fontWeight: '400' },
    medium: { fontFamily: 'DMSans_500Medium', fontWeight: '500' },
    bold: { fontFamily: 'DMSans_700Bold', fontWeight: '700' },
    heavy: { fontFamily: 'DMSans_700Bold', fontWeight: '700' },
  },
};

const AurralLightTheme: Theme = {
  dark: false,
  colors: {
    primary: Colors.light.brand,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.separator,
    notification: Colors.light.error,
  },
  fonts: {
    regular: { fontFamily: 'DMSans_400Regular', fontWeight: '400' },
    medium: { fontFamily: 'DMSans_500Medium', fontWeight: '500' },
    bold: { fontFamily: 'DMSans_700Bold', fontWeight: '700' },
    heavy: { fontFamily: 'DMSans_700Bold', fontWeight: '700' },
  },
};

function RootLayoutNav() {
  const { serverUrl, token, isRestoring } = useAuth();
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const isAuthenticated = !!serverUrl && !!token;

  useEffect(() => {
    if (!isRestoring && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isRestoring, fontsLoaded]);

  if (isRestoring || !fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? AurralDarkTheme : AurralLightTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Auth screens — visible when NOT authenticated */}
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        {/* App screens — visible when authenticated */}
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
