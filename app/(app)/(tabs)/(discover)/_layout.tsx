import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import {
  SEARCH_PLACEHOLDERS,
  TRANSPARENT_HEADER,
  layoutSearchBar,
} from "@/constants/navigation";

export default function DiscoverLayout() {
  const colors = Colors[useColorScheme()];

  return (
    <MiniPlayerHost>
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
            title: "Discover",
            headerLargeTitleEnabled: true,
          }}
        />
        <Stack.Screen
          name="artist/[mbid]"
          options={{ headerTitle: "", headerBackButtonDisplayMode: "minimal" }}
        />
        <Stack.Screen
          name="album/[ref]"
          options={{ headerTitle: "", headerBackButtonDisplayMode: "minimal" }}
        />
        <Stack.Screen
          name="release/[mbid]"
          options={{ headerTitle: "", headerBackButtonDisplayMode: "minimal" }}
        />
        <Stack.Screen
          name="list/[kind]"
          options={{
            headerLargeTitleEnabled: false,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="editorial/[id]"
          options={{ headerTitle: "", headerBackButtonDisplayMode: "minimal" }}
        />
        <Stack.Screen
          name="trending/[chart]"
          options={({ route }) => {
            const { chart, name } = (route.params ?? {}) as {
              chart?: string;
              name?: string;
            };
            return {
              title:
                chart === "songs" ? "Top Songs" : name ? `Top ${name}` : "",
              headerLargeTitleEnabled: true,
              headerBackButtonDisplayMode: "minimal",
            };
          }}
        />
        <Stack.Screen
          name="tag-results"
          options={({ route }) => ({
            title: (route.params as { q?: string })?.q ?? "Results",
            headerBackButtonDisplayMode: "minimal",
          })}
        />
        <Stack.Screen
          name="nearby-shows"
          options={{
            title: "Shows Near You",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="artist/albums"
          options={({ route }) => ({
            title: (route.params as { title?: string })?.title ?? "Albums",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.artistAlbums, colors),
          })}
        />
        <Stack.Screen
          name="artist/releases"
          options={({ route }) => ({
            title: (route.params as { title?: string })?.title ?? "Releases",
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.artistReleases, colors),
          })}
        />
      </Stack>
    </MiniPlayerHost>
  );
}
