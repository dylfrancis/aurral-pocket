import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { TopTrackRow } from "@/components/artist/TopTrackRow";
import { TopTracksSkeleton } from "@/components/artist/TopTracksSkeleton";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { Fonts, Radius } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import type { TopTrack } from "@/lib/top-tracks";

const PLAY_ALL_PLACEHOLDER = { width: 68, height: 26 };

type TopTracksSectionProps = {
  topTracks: TopTrack[];
  isLoading?: boolean;
  /** The queue id of each row, in the same order. */
  itemIds: string[];
  currentId: string | null;
  isPlaying: boolean;
  /** Plays the top tracks from this row on. */
  onPlayFrom: (index: number) => void;
  onPlayAll: () => void;
  onOpenActions: (index: number) => void;
};

export function TopTracksSection({
  topTracks,
  isLoading,
  itemIds,
  currentId,
  isPlaying,
  onPlayFrom,
  onPlayAll,
  onOpenActions,
}: TopTracksSectionProps) {
  const colors = useColors();

  if (isLoading && topTracks.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SectionLabel>Top Tracks</SectionLabel>
          <Skeleton
            width={PLAY_ALL_PLACEHOLDER.width}
            height={PLAY_ALL_PLACEHOLDER.height}
            borderRadius={Radius.round}
          />
        </View>
        <TopTracksSkeleton />
      </View>
    );
  }

  if (topTracks.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SectionLabel>Top Tracks</SectionLabel>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play top tracks"
          hitSlop={8}
          onPress={() => {
            void Haptics.selectionAsync();
            onPlayAll();
          }}
          style={({ pressed }) => [
            styles.playAll,
            { backgroundColor: colors.brandMuted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="play" size={13} color={colors.brandStrong} />
          <Text
            variant="caption"
            style={[styles.playAllLabel, { color: colors.brandStrong }]}
          >
            Play
          </Text>
        </Pressable>
      </View>
      {topTracks.map((topTrack, index) => (
        <TopTrackRow
          key={topTrack.preview.id}
          topTrack={topTrack}
          number={index + 1}
          isCurrent={currentId !== null && itemIds[index] === currentId}
          isPlaying={isPlaying}
          onPress={() => {
            void Haptics.selectionAsync();
            onPlayFrom(index);
          }}
          onOpenActions={() => onOpenActions(index)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.round,
  },
  playAllLabel: {
    ...Fonts.semiBold,
  },
});
