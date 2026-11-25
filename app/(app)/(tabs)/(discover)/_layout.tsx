import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import {
  DETAIL_SCREEN_OPTIONS,
  FULL_BLEED_SCREEN_OPTIONS,
  artistListScreenOptions,
  TOP_TRACKS_SCREEN_OPTIONS,
  artistFavoritesScreenOptions,
  artistSongsScreenOptions,
  stackScreenOptions,
} from "@/constants/navigation";
import { useColors } from "@/hooks/use-colors";
import { useSidePadding } from "@/hooks/use-side-insets";

export default function DiscoverLayout() {
  const colors = useColors();
  const sidePadding = useSidePadding();

  return (
    <MiniPlayerHost>
      <Stack screenOptions={stackScreenOptions(colors, sidePadding)}>
        <Stack.Screen
          name="index"
          options={{
            title: "Discover",
            headerLargeTitleEnabled: true,
          }}
        />
        <Stack.Screen
          name="artist/[mbid]"
          options={FULL_BLEED_SCREEN_OPTIONS}
        />
        <Stack.Screen name="album/[ref]" options={FULL_BLEED_SCREEN_OPTIONS} />
        <Stack.Screen name="release/[mbid]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen
          name="list/[kind]"
          options={{
            headerLargeTitleEnabled: false,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="editorial/[provider]/[id]"
          options={DETAIL_SCREEN_OPTIONS}
        />
        <Stack.Screen
          name="browse/[group]"
          options={({ route }) => ({
            title: (route.params as { name?: string })?.name ?? "Playlists",
            headerLargeTitleEnabled: false,
            headerBackButtonDisplayMode: "minimal",
          })}
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
          name="releases"
          options={{
            title: "Releases",
            headerLargeTitleEnabled: false,
            headerBackButtonDisplayMode: "minimal",
          }}
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
        <Stack.Screen
          name="artist/top-tracks"
          options={TOP_TRACKS_SCREEN_OPTIONS}
        />
        <Stack.Screen
          name="artist/songs"
          options={artistSongsScreenOptions(colors)}
        />
        <Stack.Screen
          name="artist/favorites"
          options={artistFavoritesScreenOptions(colors)}
        />
      </Stack>
    </MiniPlayerHost>
  );
}
