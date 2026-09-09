import { Stack } from "expo-router";
import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { TRANSPARENT_HEADER } from "@/constants/navigation";

// Queue is the tab's landing route.
export const unstable_settings = {
  initialRouteName: "queue",
};

export default function ActivityLayout() {
  const colors = Colors[useColorScheme()];

  // The three views are siblings in *this* Stack rather than screens of a
  // nested navigator. iOS only collapses a large title when it can reach the
  // scroll view by following the first child at each level, and any nested
  // navigator (a pager, a tab bar) inserts a view that breaks that chain.
  // Keeping them flat is what lets Activity behave like Library and Discover.
  const feedOptions = {
    ...TRANSPARENT_HEADER,
    title: "Activity",
    headerLargeTitleEnabled: true,
    // Switching views is a filter, not a journey — no push animation.
    animation: "none" as const,
  };

  return (
    <MiniPlayerHost>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      >
        <Stack.Screen name="queue" options={feedOptions} />
        <Stack.Screen name="review" options={feedOptions} />
        <Stack.Screen name="history" options={feedOptions} />
        <Stack.Screen
          name="artist/[mbid]"
          options={{
            ...TRANSPARENT_HEADER,
            headerTitle: "",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="album/[ref]"
          options={{
            ...TRANSPARENT_HEADER,
            headerTitle: "",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="release/[mbid]"
          options={{
            ...TRANSPARENT_HEADER,
            headerTitle: "",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="artist/albums"
          options={({ route }: any) => ({
            ...TRANSPARENT_HEADER,
            title: route.params?.title ?? "Albums",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
          })}
        />
        <Stack.Screen
          name="artist/releases"
          options={({ route }: any) => ({
            ...TRANSPARENT_HEADER,
            title: route.params?.title ?? "Releases",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
          })}
        />
      </Stack>
    </MiniPlayerHost>
  );
}
