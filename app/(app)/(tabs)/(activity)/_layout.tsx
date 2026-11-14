import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import {
  DETAIL_SCREEN_OPTIONS,
  artistListScreenOptions,
  stackScreenOptions,
} from "@/constants/navigation";
import { IS_ANDROID } from "@/constants/platform";
import { useColors } from "@/hooks/use-colors";

// Queue is the tab's landing route.
export const unstable_settings = {
  anchor: "queue",
};

export default function ActivityLayout() {
  const colors = useColors();

  // The three views are siblings in *this* Stack rather than screens of a
  // nested navigator. iOS only collapses a large title when it can reach the
  // scroll view by following the first child at each level, and any nested
  // navigator (a pager, a tab bar) inserts a view that breaks that chain.
  // Keeping them flat is what lets Activity behave like Library and Discover.
  const feedOptions = {
    title: "Activity",
    headerLargeTitleEnabled: true,
    // Switching views is a filter, not a journey — no push animation.
    animation: "none" as const,
  };

  return (
    <MiniPlayerHost aboveTabs={IS_ANDROID}>
      <Stack screenOptions={stackScreenOptions(colors)}>
        <Stack.Screen name="queue" options={feedOptions} />
        <Stack.Screen name="review" options={feedOptions} />
        <Stack.Screen name="history" options={feedOptions} />
        <Stack.Screen name="artist/[mbid]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen name="album/[ref]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen name="release/[mbid]" options={DETAIL_SCREEN_OPTIONS} />
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
