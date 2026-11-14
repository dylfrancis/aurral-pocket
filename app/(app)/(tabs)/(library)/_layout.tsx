import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import {
  DETAIL_SCREEN_OPTIONS,
  SEARCH_PLACEHOLDERS,
  artistListScreenOptions,
  layoutSearchBar,
  stackScreenOptions,
} from "@/constants/navigation";
import { Stack } from "expo-router";
import { useColors } from "@/hooks/use-colors";

export default function LibraryLayout() {
  const colors = useColors();

  return (
    <MiniPlayerHost>
      <Stack screenOptions={stackScreenOptions(colors)}>
        <Stack.Screen
          name="index"
          options={{
            title: "Library",
            headerLargeTitleEnabled: true,
          }}
        />
        <Stack.Screen
          name="artists"
          options={{
            title: "Artists",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.artists, colors),
          }}
        />
        <Stack.Screen
          name="albums"
          options={{
            title: "Albums",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.albums, colors),
          }}
        />
        <Stack.Screen
          name="genres"
          options={{
            title: "Genres",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.genres, colors),
          }}
        />
        <Stack.Screen
          name="genre/[genre]"
          options={({ route }) => ({
            title: (route.params as { genre?: string })?.genre ?? "Genre",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.albums, colors),
          })}
        />
        <Stack.Screen
          name="favorites"
          options={{
            title: "Favorites",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.favorites, colors),
          }}
        />
        <Stack.Screen
          name="playlists"
          options={{
            title: "Playlists",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="offline"
          options={{
            title: "Offline",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen name="playlist/[id]" options={DETAIL_SCREEN_OPTIONS} />
        <Stack.Screen
          name="playlist-edit"
          options={{
            title: "Playlist",
            headerBackButtonDisplayMode: "minimal",
            presentation: "card",
          }}
        />
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
        <Stack.Screen
          name="blocklist"
          options={{
            title: "Blocklist",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.blocklist, colors),
          }}
        />
      </Stack>
    </MiniPlayerHost>
  );
}
