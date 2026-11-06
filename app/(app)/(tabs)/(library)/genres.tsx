import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FilterList from "@expo/material-symbols/filter_list.xml";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import * as Burnt from "burnt";
import type { SearchBarTextEventData } from "react-native-screens";
import {
  GENRE_SORT_OPTIONS,
  type GenreSortMode,
} from "@/components/library/AlbumSortPicker";
import { EmptyState } from "@/components/library/EmptyState";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { Text } from "@/components/ui/Text";
import { searchBarColors } from "@/constants/navigation";
import { Colors, Fonts } from "@/constants/theme";
import { useLibraryGenres } from "@/hooks/library/use-library-genres";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CanonicalGenre } from "@/lib/types/library";

const EDGE_PADDING = 12;

const countLabel = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

type GenreOrder = (a: CanonicalGenre, b: CanonicalGenre) => number;

const byName: GenreOrder = (a, b) => a.name.localeCompare(b.name);

const mostFirst =
  (count: "tracks" | "albums" | "artists"): GenreOrder =>
  (a, b) =>
    b[count] - a[count] || byName(a, b);

const GENRE_ORDERS: Record<GenreSortMode, GenreOrder> = {
  "name-asc": byName,
  "name-desc": (a, b) => byName(b, a),
  tracks: mostFirst("tracks"),
  albums: mostFirst("albums"),
  artists: mostFirst("artists"),
};

export default function LibraryGenresScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const { data: genres, refetch } = useLibraryGenres();

  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const [sortMode, setSortMode] = useState<GenreSortMode>("name-asc");

  // Stable, like the memoized toolbar below, so a keystroke doesn't rebuild
  // the native header config.
  const handleSearchChange = useCallback(
    (e: NativeSyntheticEvent<SearchBarTextEventData>) =>
      setSearchQuery(e.nativeEvent.text),
    [],
  );
  const handleSearchCancel = useCallback(() => setSearchQuery(""), []);

  const sortedGenres = useMemo(
    () => [...genres].sort(GENRE_ORDERS[sortMode]),
    [genres, sortMode],
  );
  const visibleGenres = useMemo(() => {
    const query = trimmedQuery.toLocaleLowerCase();
    return sortedGenres.filter((genre) =>
      genre.name.toLocaleLowerCase().includes(query),
    );
  }, [sortedGenres, trimmedQuery]);

  // Its own flag, not isRefetching, so a refetch nobody pulled for shows no
  // spinner.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const result = await refetch();
    setRefreshing(false);
    if (result.isError) {
      Burnt.toast({ title: "Couldn't refresh genres", preset: "error" });
    }
  }, [refetch]);

  // A param, not an interpolated path: a name holding `/` or `&` stays one
  // route segment.
  const openGenre = useCallback(
    (genre: CanonicalGenre) => {
      router.push({
        pathname: "/genre/[genre]",
        params: { genre: genre.name },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: CanonicalGenre }) => (
      <GenreRow genre={item} onPress={() => openGenre(item)} />
    ),
    [openGenre],
  );

  const sortToolbar = useMemo(
    () => (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            process.env.EXPO_OS === "ios"
              ? "line.3.horizontal.decrease"
              : FilterList
          }
          title="Sort By"
        >
          {GENRE_SORT_OPTIONS.map((option) => (
            <Stack.Toolbar.MenuAction
              key={option.key}
              icon={
                process.env.EXPO_OS === "ios"
                  ? (option.iosIcon as any)
                  : option.androidIcon
              }
              isOn={sortMode === option.key}
              onPress={() => setSortMode(option.key)}
            >
              {option.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    ),
    [sortMode],
  );

  return (
    <>
      <Stack.SearchBar
        placeholder="Search genres"
        hideWhenScrolling={false}
        autoCapitalize="none"
        {...searchBarColors(colors)}
        onChangeText={handleSearchChange}
        onCancelButtonPress={handleSearchCancel}
      />
      {sortToolbar}
      <FlashList
        key={sortMode}
        data={visibleGenres}
        renderItem={renderItem}
        keyExtractor={(genre) => genre.name}
        ListEmptyComponent={
          trimmedQuery ? (
            <EmptyState
              icon="search-outline"
              message={`No results matching “${trimmedQuery}”`}
            />
          ) : (
            <EmptyState icon="pricetags-outline" message="No genres to show" />
          )
        }
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingTop: EDGE_PADDING,
          backgroundColor: colors.background,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand}
          />
        }
      />
    </>
  );
}

function GenreRow({
  genre,
  onPress,
}: {
  genre: CanonicalGenre;
  onPress: () => void;
}) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.meta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.name, { color: colors.text }]}
        >
          {genre.name}
        </Text>
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: colors.subtle }}
        >
          {[
            countLabel(genre.artists, "artist"),
            countLabel(genre.albums, "album"),
            countLabel(genre.tracks, "track"),
          ].join(" · ")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
    </Pressable>
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load genres" />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Fonts.medium,
  },
});
