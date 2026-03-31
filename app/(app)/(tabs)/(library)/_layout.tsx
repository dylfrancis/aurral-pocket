import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function LibraryLayout() {
  const colors = Colors[useColorScheme()];

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Library',
          headerLargeTitle: true,

          ...(Platform.OS === 'ios'
            ? {
                headerTransparent: true,
                headerStyle: { backgroundColor: 'transparent' },
              }
            : {}),
        }}
      />
      <Stack.Screen
        name="artist/[mbid]"
        options={{ headerTransparent: true, headerStyle: { backgroundColor: 'transparent' }, headerTitle: '', }}
      />
    </Stack>
  );
}
