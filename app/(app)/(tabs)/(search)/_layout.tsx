import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import {
  DETAIL_SCREEN_OPTIONS,
  artistListScreenOptions,
  stackScreenOptions,
} from "@/constants/navigation";
import { useColors } from "@/hooks/use-colors";

export default function SearchLayout() {
  const colors = useColors();

  return (
    <MiniPlayerHost>
      <Stack screenOptions={stackScreenOptions(colors)}>
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
        <Stack.Screen name="artist/[mbid]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen name="album/[ref]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen name="release/[mbid]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen
          name="artist/releases"
          options={artistListScreenOptions("releases", colors)}
        />
      </Stack>
    </MiniPlayerHost>
  );
}
