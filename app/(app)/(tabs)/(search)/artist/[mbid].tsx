import { useCallback, useRef, useState } from "react";
import { FlatList, Linking, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import BottomSheet from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArtistHero } from "@/components/library/ArtistHero";
import { ArtistTags } from "@/components/library/ArtistTags";
import { PreviewTrackRow } from "@/components/library/PreviewTrackRow";
import { SimilarArtistCard } from "@/components/search/SimilarArtistCard";
import { AddArtistSheet } from "@/components/search/AddArtistSheet";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { usePreviewPlayer } from "@/hooks/library/use-preview-player";
import { useArtistDetails } from "@/hooks/library/use-artist-details";
import { useSimilarArtists } from "@/hooks/search/use-similar-artists";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import type { SimilarArtist } from "@/lib/types/search";

export default function SearchArtistDetailScreen() {
  const { mbid, name } = useLocalSearchParams<{ mbid: string; name: string }>();
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { isInLibrary } = useLibraryLookup();
  const inLibrary = isInLibrary(mbid!);
  const { stop: stopPreview, ...preview } = usePreviewPlayer(mbid, name);
  const { data: details } = useArtistDetails(mbid);
  const { data: similarArtists } = useSimilarArtists(mbid);

  const addArtistSheetRef = useRef<BottomSheet>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioTruncated, setBioTruncated] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleSimilarPress = useCallback(
    (artist: SimilarArtist) => {
      stopPreview();
      router.push({
        pathname: "/artist/[mbid]",
        params: { mbid: artist.id, name: artist.name },
      });
    },
    [router, stopPreview],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <ArtistHero
          artist={{ mbid: mbid!, artistName: name! }}
          scrollY={scrollY}
        />

        <View style={styles.libraryAction}>
          {inLibrary ? (
            <Chip label="In Library" icon="checkmark-circle" variant="brand" />
          ) : (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                addArtistSheetRef.current?.snapToIndex(0);
              }}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text variant="body" style={styles.addButtonText}>
                Add to Library
              </Text>
            </Pressable>
          )}
        </View>

        <ArtistTags mbid={mbid!} />

        {/* Top Tracks */}
        {preview.tracks && preview.tracks.length > 0 && (
          <View style={styles.section}>
            <Text
              variant="caption"
              style={[styles.sectionLabel, { color: colors.subtle }]}
            >
              Top Tracks
            </Text>
            {preview.tracks.map((track) => (
              <PreviewTrackRow
                key={track.id}
                track={track}
                isPlaying={preview.playingId === track.id}
                progress={preview.playingId === track.id ? preview.progress : 0}
                onToggle={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  preview.toggle(track);
                }}
              />
            ))}
          </View>
        )}

        {/* Similar Artists */}
        {similarArtists && similarArtists.length > 0 && (
          <View style={styles.similarSection}>
            <Text
              variant="caption"
              style={[
                styles.sectionLabel,
                styles.sectionLabelPadded,
                { color: colors.subtle },
              ]}
            >
              Similar Artists
            </Text>
            <FlatList
              horizontal
              data={similarArtists}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SimilarArtistCard
                  artist={item}
                  isInLibrary={isInLibrary(item.id)}
                  onPress={() => handleSimilarPress(item)}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarList}
            />
          </View>
        )}

        {/* Bio */}
        {details?.bio && (
          <View style={styles.bioSection}>
            <Text
              variant="caption"
              style={[styles.sectionLabel, { color: colors.subtle }]}
            >
              About
            </Text>
            <Text
              variant="caption"
              style={styles.bio}
              numberOfLines={bioExpanded ? undefined : 4}
              onTextLayout={(e) =>
                setBioTruncated(e.nativeEvent.lines.length >= 4)
              }
            >
              {details.bio}
            </Text>
            {(bioTruncated || bioExpanded) && (
              <Pressable onPress={() => setBioExpanded((prev) => !prev)}>
                <Text variant="caption" style={{ color: colors.brand }}>
                  {bioExpanded ? "Show less" : "Show more"}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* External Links */}
        <View style={styles.links}>
          <Pressable
            style={({ pressed }) => [
              styles.linkButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() =>
              Linking.openURL(
                `https://www.last.fm/music/${encodeURIComponent(name!)}`,
              )
            }
          >
            <Ionicons name="open-outline" size={18} color={colors.brand} />
            <Text variant="caption" style={{ color: colors.text }}>
              Last.fm
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.linkButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() =>
              Linking.openURL(`https://musicbrainz.org/artist/${mbid}`)
            }
          >
            <Ionicons name="open-outline" size={18} color={colors.brand} />
            <Text variant="caption" style={{ color: colors.text }}>
              MusicBrainz
            </Text>
          </Pressable>
        </View>
      </Animated.ScrollView>

      <AddArtistSheet
        mbid={mbid!}
        artistName={name!}
        sheetRef={addArtistSheetRef}
        onAdded={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  libraryAction: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  addButtonText: {
    color: "#fff",
    fontFamily: Fonts.semiBold,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
  },
  sectionLabelPadded: {
    paddingHorizontal: 16,
  },
  similarSection: {
    paddingTop: 8,
  },
  similarList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bioSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 6,
  },
  bio: {
    lineHeight: 18,
  },
  links: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
});
