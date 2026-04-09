import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const IS_IOS = Platform.OS === 'ios';

const transparentHeader = IS_IOS
  ? { headerTransparent: true, headerStyle: { backgroundColor: 'transparent' } }
  : {};

export default function LibraryLayout() {
  const colors = Colors[useColorScheme()];

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        ...transparentHeader,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Library',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="artist/[mbid]"
        options={{ headerTitle: '', headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="albums"
        options={({ route }: any) => ({
          title: route.params?.title ?? 'Albums',
          headerLargeTitle: true,
          headerBackButtonDisplayMode: 'minimal',
        })}
      />
    </Stack>
  );
}
