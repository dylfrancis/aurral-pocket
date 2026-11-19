import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import ShuffleIcon from "@expo/material-symbols/shuffle.xml";
import { LibraryAlbumRail } from "@/components/library/LibraryAlbumRail";
import { OverflowMenu } from "@/components/navigation/OverflowMenu";
import { Text } from "@/components/ui/Text";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { preloadLibraryViews } from "@/hooks/library/use-library-view";
import {
  readShuffleSongs,
  songListContext,
  usePlayLibrarySongs,
} from "@/hooks/library/use-play-library-songs";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useIsOffline } from "@/lib/offline/network";

type Category = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: Href;
  requiresPlaylistAccess?: boolean;
};

/**
 * The library home starts with a category list: every row pushes a screen and
 * needs no read, so the list paints at once however large the library is, and
 * works with no connection. The album rails come after it, and Shuffle Library
 * sits in the top bar.
 */
const CATEGORIES: Category[] = [
  { icon: "people-outline", label: "Artists", route: "/artists" },
  { icon: "disc-outline", label: "Albums", route: "/albums" },
  { icon: "musical-notes-outline", label: "Songs", route: "/songs" },
  { icon: "pricetags-outline", label: "Genres", route: "/genres" },
  { icon: "heart-outline", label: "Favorites", route: "/favorites" },
  {
    icon: "list-outline",
    label: "Playlists",
    route: "/playlists",
    requiresPlaylistAccess: true,
  },
  // Reads only the phone, so it's the way in with no connection.
  { icon: "arrow-down-circle-outline", label: "Offline", route: "/offline" },
];

const ICON_SIZE = 22;
const LIBRARY_SHUFFLE = songListContext("Library");

export default function LibraryScreen() {
  const router = useRouter();
  const hasPermission = useHasPermission();
  const categories = CATEGORIES.filter(
    (category) =>
      !category.requiresPlaylistAccess || hasPermission("accessPlaylists"),
  );
  useEffect(preloadLibraryViews, []);
  const isOffline = useIsOffline();

  // Played rails move with every play, so they reread on each return to the
  // tab. Explore stays put: the album just opened from it shouldn't vanish.
  const [playedKey, setPlayedKey] = useState(0);
  const rereadPlayed = useCallback(() => setPlayedKey((key) => key + 1), []);
  useRefreshOnFocus(rereadPlayed);

  // About 500 songs drawn from across the whole Library. Stable, because a
  // new handler rebuilds the native header.
  const { readAndPlay, isLoading: shuffleLoading } = usePlayLibrarySongs();
  const shuffleLibrary = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void readAndPlay(() => readShuffleSongs({}), LIBRARY_SHUFFLE, {
      shuffled: true,
    });
  }, [readAndPlay]);

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={IS_IOS ? "shuffle" : ShuffleIcon}
          accessibilityLabel="Shuffle Library"
          // It reads the server, and a second tap while it reads does nothing.
          disabled={isOffline || shuffleLoading}
          onPress={shuffleLibrary}
        >
          Shuffle Library
        </Stack.Toolbar.Button>
        {IS_ANDROID && <OverflowMenu />}
      </Stack.Toolbar>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {categories.map((category, index) => (
          <CategoryRow
            key={category.label}
            category={category}
            // The last row drops its separator, so the list does not end on a
            // hairline hanging under nothing.
            separator={index < categories.length - 1}
            onPress={() => router.push(category.route)}
          />
        ))}
        {/* Every rail reads the server, so none shows offline. */}
        {isOffline ? null : (
          <View style={styles.rails}>
            <LibraryAlbumRail
              title="Recently Played"
              sort="played"
              refreshKey={playedKey}
            />
            <LibraryAlbumRail
              title="Most Played"
              sort="plays"
              refreshKey={playedKey}
            />
            <LibraryAlbumRail title="Recently Added" sort="newest" />
            <LibraryAlbumRail
              title="Recently Released"
              sort="released"
              availableOnly
            />
            <LibraryAlbumRail
              title="Explore"
              sort="random"
              availableOnly
              showAll={false}
            />
          </View>
        )}
      </ScrollView>
    </>
  );
}

function CategoryRow({
  category,
  separator,
  onPress,
}: {
  category: Category;
  separator: boolean;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.6 : 1 },
        separator && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
      ]}
    >
      <Ionicons name={category.icon} size={ICON_SIZE} color={colors.brand} />
      <Text variant="body" style={[styles.label, { color: colors.text }]}>
        {category.label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  rails: {
    paddingTop: 20,
    gap: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    gap: 14,
  },
  label: {
    flex: 1,
    fontSize: 17,
    ...Fonts.medium,
  },
});
