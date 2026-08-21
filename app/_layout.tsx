import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import type { AppStateStatus } from "react-native";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/contexts/auth-context";
import {
  ThemeProvider as ThemePreferenceProvider,
  useThemePreference,
} from "@/contexts/theme-context";
import { OidcLogoutWebView } from "@/components/auth/OidcLogoutWebView";
import { ReAuthModal } from "@/components/auth/ReAuthModal";
import { FlowAudioPreviewProvider } from "@/hooks/flow";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { queryClient } from "@/lib/query-client";

SplashScreen.preventAutoHideAsync();

// Let React Query see app background/foreground transitions so queries with
// refetchOnWindowFocus refresh on resume and intervals pause in background.
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

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
  fonts: DarkTheme.fonts,
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
  fonts: DefaultTheme.fonts,
};

function RootLayoutNav() {
  const { serverUrl, token, isRestoring } = useAuth();
  const { isThemeLoaded } = useThemePreference();
  const colorScheme = useColorScheme();

  const isAuthenticated = !!serverUrl && !!token;

  useEffect(() => {
    if (!isRestoring && isThemeLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isRestoring, isThemeLoaded]);

  if (isRestoring || !isThemeLoaded) return null;

  return (
    <ThemeProvider
      value={colorScheme === "dark" ? AurralDarkTheme : AurralLightTheme}
    >
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
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThemePreferenceProvider>
                <FlowAudioPreviewProvider>
                  <BottomSheetModalProvider>
                    <RootLayoutNav />
                    <ReAuthModal />
                    {/* Above the router, so a logout survives the navigation
                        back to the login screen. */}
                    <OidcLogoutWebView />
                  </BottomSheetModalProvider>
                </FlowAudioPreviewProvider>
              </ThemePreferenceProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
