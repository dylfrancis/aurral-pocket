import { useCallback } from "react";
import { FlatList, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { TopTrackRow } from "@/components/artist/TopTrackRow";
import { TopTracksSkeleton } from "@/components/artist/TopTracksSkeleton";
import { TrackActionsSheet } from "@/components/library/TrackActionsSheet";
import { Text } from "@/components/ui/Text";
import { useArtistTopTracks } from "@/hooks/library/use-artist-top-tracks";
import { useTopTracksPlayback } from "@/hooks/library/use-top-tracks-playback";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useColors } from "@/hooks/use-colors";
import type { TopTrack } from "@/lib/top-tracks";

type RouteParams = {
  mbid: string;
  artistName?: string;
};

/** Every top track of an artist, opened from the artist page's Show All. */
export function TopTracksScreen() {
  const { mbid, artistName = "" } = useLocalSearchParams<RouteParams>();
  const colors = useColors();
  const { isInLibrary } = useLibraryLookup([mbid]);
  const { topTracks, isLoading } = useArtistTopTracks(
    mbid,
    artistName,
    isInLibrary(mbid),
  );
  const { itemIds, currentId, isPlaying, playFrom, openActions, actions } =
    useTopTracksPlayback(topTracks, artistName, mbid);

  const renderItem = useCallback(
    ({ item, index }: { item: TopTrack; index: number }) => (
      <TopTrackRow
        topTrack={item}
        number={index + 1}
        isCurrent={currentId !== null && itemIds[index] === currentId}
        isPlaying={isPlaying}
        onPress={() => {
          void Haptics.selectionAsync();
          playFrom(index);
        }}
        onOpenActions={() => openActions(index)}
      />
    ),
    [currentId, itemIds, isPlaying, playFrom, openActions],
  );

  return (
    <>
      <FlatList
        data={topTracks}
        renderItem={renderItem}
        keyExtractor={(topTrack) => topTrack.preview.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          isLoading ? (
            <TopTracksSkeleton count={10} />
          ) : (
            <Text variant="caption" style={styles.empty}>
              No top tracks to show
            </Text>
          )
        }
      />
      <TrackActionsSheet target={actions.target} onClose={actions.close} />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  empty: {
    textAlign: "center",
    paddingVertical: 48,
  },
});
