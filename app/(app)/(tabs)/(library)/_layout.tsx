import { MiniPlayerHost } from "@/components/player/MiniPlayerHost";
import {
  SEARCH_PLACEHOLDERS,
  TRANSPARENT_HEADER,
  layoutSearchBar,
} from "@/constants/navigation";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Stack } from "expo-router";

export default function LibraryLayout() {
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
          options={({ route }: any) => ({
            title: route.params?.genre ?? "Genre",
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
          name="playlist/[id]"
          options={{ headerTitle: "", headerBackButtonDisplayMode: "minimal" }}
        />
        <Stack.Screen
          name="playlist-edit"
          options={{
            title: "Playlist",
            headerBackButtonDisplayMode: "minimal",
            presentation: "card",
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
          name="artist/albums"
          options={({ route }: any) => ({
            title: route.params?.title ?? "Albums",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.artistAlbums, colors),
          })}
        />
        <Stack.Screen
          name="artist/releases"
          options={({ route }: any) => ({
            title: route.params?.title ?? "Releases",
            headerLargeTitleEnabled: true,
            headerBackButtonDisplayMode: "minimal",
            ...layoutSearchBar(SEARCH_PLACEHOLDERS.artistReleases, colors),
          })}
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
