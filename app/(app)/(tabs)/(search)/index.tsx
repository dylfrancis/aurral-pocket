import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { SearchBar } from "@/components/library/SearchBar";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonRows } from "@/components/search/SkeletonRows";
import { SearchPreviewRow } from "@/components/search/SearchPreviewRow";
import { SearchArtistRow } from "@/components/search/SearchArtistRow";
import { SearchAlbumRow } from "@/components/search/SearchAlbumRow";
import { SearchAlbumSheet } from "@/components/search/SearchAlbumSheet";
import { RecentSearches } from "@/components/search/RecentSearches";
import { Text } from "@/components/ui/Text";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useAlbumSearch } from "@/hooks/search/use-album-search";
import { useTagSuggestions } from "@/hooks/search/use-tag-suggestions";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useRecentSearches } from "@/hooks/search/use-recent-searches";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { IS_ANDROID, IS_IOS } from "@/constants/platform";
import type { RecentSearch } from "@/hooks/search/use-recent-searches";
import type { SearchAlbum, SearchArtist } from "@/lib/types/search";

const ARTIST_PREVIEW_LIMIT = 3;
const ALBUM_PREVIEW_LIMIT = 3;
const TAG_PREVIEW_LIMIT = 5;

export default function SearchScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const colors = Colors[useColorScheme()];

  const [query, setQuery] = useState("");
  const recentSearches = useRecentSearches();

  const isTagSearch = query.trimStart().startsWith("#");
  const tagQuery = isTagSearch ? query.trimStart().slice(1).trim() : "";
  const artistQuery = isTagSearch ? "" : query;
  const hasQuery =
    query.trim().length >= 2 || (isTagSearch && tagQuery.length >= 2);

  const {
    data: artistData,
    isLoading: artistLoading,
    isPlaceholderData: artistIsStale,
  } = useArtistSearch(artistQuery);

  const {
    data: albumData,
    isLoading: albumLoading,
    isPlaceholderData: albumIsStale,
  } = useAlbumSearch(artistQuery);

  const { data: tags } = useTagSuggestions(
    isTagSearch ? tagQuery : artistQuery,
  );
  const { isInLibrary } = useLibraryLookup();

  const artists = artistData?.artists;
  const albums = albumData?.items;

  const pushResults = useCallback(
    (q: string, scope?: "artist" | "album") => {
      Keyboard.dismiss();
      if (q.startsWith("#")) {
        recentSearches.add({ type: "tag", text: q.slice(1) });
      } else {
        recentSearches.add({ type: "query", text: q });
      }
      router.push({
        pathname: "/results",
        params: scope ? { q, scope } : { q },
      });
    },
    [router, recentSearches],
  );

  const handleSubmit = useCallback(() => {
    if (query.trim()) pushResults(query.trim());
  }, [query, pushResults]);

  const handleTagSelect = useCallback(
    (tag: string) => pushResults(`#${tag}`),
    [pushResults],
  );

  const handleArtistPress = useCallback(
    (artist: SearchArtist) => {
      recentSearches.add({
        type: "artist",
        text: artist.name,
        mbid: artist.id,
      });
      router.push({
        pathname: "/artist/[mbid]",
        params: { mbid: artist.id, name: artist.name },
      });
    },
    [router, recentSearches],
  );

  useEffect(() => {
    if (IS_IOS) {
      navigation.setOptions({
        headerSearchBarOptions: {
          placeholder: "Artists, bands, #tags...",
          hideWhenScrolling: false,
          autoCapitalize: "none",
          onChangeText: (e: { nativeEvent: { text: string } }) => {
            setQuery(e.nativeEvent.text);
          },
          onCancelButtonPress: () => setQuery(""),
          onSearchButtonPress: handleSubmit,
        },
      });
    }
  }, [navigation, handleSubmit]);

  const previewTags = hasQuery
    ? (tags ?? []).slice(0, isTagSearch ? TAG_PREVIEW_LIMIT : 3)
    : [];
  const previewArtists =
    hasQuery && !isTagSearch
      ? (artists ?? []).slice(0, ARTIST_PREVIEW_LIMIT)
      : [];
  const previewAlbums =
    hasQuery && !isTagSearch
      ? (albums ?? []).slice(0, ALBUM_PREVIEW_LIMIT)
      : [];

  const showArtistSkeleton =
    hasQuery && !isTagSearch && (artistLoading || artistIsStale);
  const showAlbumSkeleton =
    hasQuery && !isTagSearch && (albumLoading || albumIsStale);
  const showArtistSection = showArtistSkeleton || previewArtists.length > 0;
  const showAlbumSection = showAlbumSkeleton || previewAlbums.length > 0;

  const noResults =
    hasQuery &&
    !isTagSearch &&
    !artistLoading &&
    !albumLoading &&
    !artistIsStale &&
    !albumIsStale &&
    previewArtists.length === 0 &&
    previewAlbums.length === 0 &&
    previewTags.length === 0;

  const noTagResults = hasQuery && isTagSearch && previewTags.length === 0;

  const sheetRef = useRef<BottomSheetModal | null>(null);
  const [activeAlbum, setActiveAlbum] = useState<SearchAlbum | null>(null);
  const handleAlbumPress = useCallback((album: SearchAlbum) => {
    setActiveAlbum(album);
    sheetRef.current?.present();
  }, []);

  let content;

  if (noResults || noTagResults) {
    content = (
      <EmptyState
        icon="search-outline"
        message={`No results for \u201C${query.trim()}\u201D`}
      />
    );
  } else if (hasQuery) {
    const hasMoreArtists =
      !isTagSearch && (artists?.length ?? 0) > ARTIST_PREVIEW_LIMIT;
    const hasMoreAlbums =
      !isTagSearch && (albums?.length ?? 0) > ALBUM_PREVIEW_LIMIT;
    const hasMoreTags = isTagSearch && (tags?.length ?? 0) > TAG_PREVIEW_LIMIT;

    content = (
      <View style={styles.previewSection}>
        {previewTags.length > 0 && (
          <View>
            <SectionLabel text="Tags" colorSubtle={colors.subtle} />
            {previewTags.map((tag) => (
              <SearchPreviewRow
                key={`tag-${tag}`}
                icon="pricetag-outline"
                iconColor={colors.brandStrong}
                label={`#${tag}`}
                onPress={() => handleTagSelect(tag)}
              />
            ))}
          </View>
        )}

        {showArtistSection && (
          <View>
            <SectionLabel text="Artists" colorSubtle={colors.subtle} />
            {showArtistSkeleton ? (
              <SkeletonRows count={ARTIST_PREVIEW_LIMIT} variant="artist" />
            ) : (
              <>
                {previewArtists.map((artist) => (
                  <SearchArtistRow
                    key={`artist-${artist.id}`}
                    artist={artist}
                    isInLibrary={isInLibrary(artist.id)}
                    onPress={() => handleArtistPress(artist)}
                  />
                ))}
                {hasMoreArtists && (
                  <SeeAllRow
                    label="See all artists"
                    color={colors.brand}
                    onPress={() => pushResults(query.trim(), "artist")}
                  />
                )}
              </>
            )}
          </View>
        )}

        {showAlbumSection && (
          <View>
            <SectionLabel text="Albums" colorSubtle={colors.subtle} />
            {showAlbumSkeleton ? (
              <SkeletonRows count={ALBUM_PREVIEW_LIMIT} variant="album" />
            ) : (
              <>
                {previewAlbums.map((album) => (
                  <SearchAlbumRow
                    key={`album-${album.id}`}
                    album={album}
                    onPress={() => handleAlbumPress(album)}
                  />
                ))}
                {hasMoreAlbums && (
                  <SeeAllRow
                    label="See all albums"
                    color={colors.brand}
                    onPress={() => pushResults(query.trim(), "album")}
                  />
                )}
              </>
            )}
          </View>
        )}

        {hasMoreTags && (
          <SeeAllRow
            label="See all tag results"
            color={colors.brand}
            onPress={handleSubmit}
          />
        )}
      </View>
    );
  } else if (recentSearches.searches.length > 0) {
    content = (
      <RecentSearches
        searches={recentSearches.searches}
        onSelect={(entry: RecentSearch) => {
          if (entry.type === "artist") {
            router.push({
              pathname: "/artist/[mbid]",
              params: { mbid: entry.mbid, name: entry.text },
            });
          } else if (entry.type === "tag") {
            pushResults(`#${entry.text}`);
          } else {
            pushResults(entry.text);
          }
        }}
        onRemove={recentSearches.remove}
        onClear={recentSearches.clear}
      />
    );
  } else {
    content = (
      <EmptyState
        icon="search-outline"
        message="Search for artists or #tags to discover music"
      />
    );
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {IS_ANDROID && (
          <View style={styles.androidSearchBar}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              sortMode="alpha"
              onSortChange={() => {}}
              showSort={false}
              onSubmit={handleSubmit}
            />
          </View>
        )}
        {content}
      </ScrollView>
      <SearchAlbumSheet album={activeAlbum} sheetRef={sheetRef} />
    </>
  );
}

function SectionLabel({
  text,
  colorSubtle,
}: {
  text: string;
  colorSubtle: string;
}) {
  return (
    <Text
      variant="caption"
      style={[styles.sectionLabel, { color: colorSubtle }]}
    >
      {text}
    </Text>
  );
}

function SeeAllRow({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.seeAllRow,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text variant="body" style={[styles.seeAllText, { color }]}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  androidSearchBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  previewSection: {
    paddingTop: 4,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  seeAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 4,
  },
  seeAllText: {
    fontFamily: Fonts.semiBold,
  },
});
