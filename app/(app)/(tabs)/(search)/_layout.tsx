import { Stack } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";

const transparentHeader = IS_IOS
  ? { headerTransparent: true, headerStyle: { backgroundColor: "transparent" } }
  : {};

export default function SearchLayout() {
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
          title: "Search",
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="results"
        options={({ route }) => ({
          title: (route.params as { q?: string })?.q ?? "Results",
          headerBackButtonDisplayMode: "minimal",
        })}
      />
      <Stack.Screen
        name="artist/[mbid]"
        options={{ headerTitle: "", headerBackButtonDisplayMode: "minimal" }}
      />
      <Stack.Screen
        name="artist/releases"
        options={({ route }) => ({
          title: (route.params as { title?: string })?.title ?? "Releases",
          headerBackButtonDisplayMode: "minimal",
        })}
      />
    </Stack>
  );
}
