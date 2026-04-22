import { Stack } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { TRANSPARENT_HEADER } from "@/constants/navigation";

export default function LibraryLayout() {
  const colors = Colors[useColorScheme()];

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        ...TRANSPARENT_HEADER,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Library",
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="artist/[mbid]"
        options={{ headerTitle: "", headerBackButtonDisplayMode: "minimal" }}
      />
      <Stack.Screen
        name="artist/albums"
        options={({ route }: any) => ({
          title: route.params?.title ?? "Albums",
          headerLargeTitleEnabled: true,
          headerBackButtonDisplayMode: "minimal",
        })}
      />
      <Stack.Screen
        name="artist/releases"
        options={({ route }: any) => ({
          title: route.params?.title ?? "Releases",
          headerLargeTitleEnabled: true,
          headerBackButtonDisplayMode: "minimal",
        })}
      />
    </Stack>
  );
}
