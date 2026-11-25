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

export default function SearchLayout() {
  const colors = useColors();
  const sidePadding = useSidePadding();

  return (
    <MiniPlayerHost>
      <Stack screenOptions={stackScreenOptions(colors, sidePadding)}>
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
          options={FULL_BLEED_SCREEN_OPTIONS}
        />
        <Stack.Screen name="album/[ref]" options={FULL_BLEED_SCREEN_OPTIONS} />
        <Stack.Screen name="release/[mbid]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen name="flow/[id]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen name="playlist/[id]" options={DETAIL_SCREEN_OPTIONS} />
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
