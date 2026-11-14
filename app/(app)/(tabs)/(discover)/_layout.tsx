import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import {
  DETAIL_SCREEN_OPTIONS,
  artistListScreenOptions,
  stackScreenOptions,
} from "@/constants/navigation";

export default function DiscoverLayout() {
  const colors = Colors[useColorScheme()];

  return (
    <MiniPlayerHost>
      <Stack screenOptions={stackScreenOptions(colors)}>
        <Stack.Screen
          name="index"
          options={{
            title: "Discover",
            headerLargeTitleEnabled: true,
          }}
        />
        <Stack.Screen name="artist/[mbid]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen name="album/[ref]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen name="release/[mbid]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen
          name="list/[kind]"
          options={{
            headerLargeTitleEnabled: false,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen name="editorial/[id]" options={DETAIL_SCREEN_OPTIONS} />
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
          options={artistListScreenOptions("albums", colors)}
        />
        <Stack.Screen
          name="artist/releases"
          options={artistListScreenOptions("releases", colors)}
        />
      </Stack>
    </MiniPlayerHost>
  );
}
