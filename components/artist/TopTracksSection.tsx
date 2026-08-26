import { StyleSheet, View } from "react-native";
import { PreviewTrackRow } from "@/components/library/PreviewTrackRow";
import { TopTracksSkeleton } from "@/components/artist/TopTracksSkeleton";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import type { PreviewTrack } from "@/lib/types/library";

type TopTracksSectionProps = {
  tracks: PreviewTrack[];
  isLoading?: boolean;
  playingId: string | null;
  /** The clip the player is still downloading; its row shows a spinner. */
  loadingId?: string | null;
  progress: number;
  onToggle: (track: PreviewTrack) => void;
  /** Rows show a "+" button on the right when this is set. */
  onAddToPlaylist?: (track: PreviewTrack) => void;
};

export function TopTracksSection({
  tracks,
  isLoading,
  playingId,
  loadingId,
  progress,
  onToggle,
  onAddToPlaylist,
}: TopTracksSectionProps) {
  const colors = Colors[useColorScheme()];

  if (isLoading && tracks.length === 0) {
    return (
      <View style={styles.container}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Top Tracks
        </Text>
        <TopTracksSkeleton />
      </View>
    );
  }

  if (tracks.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text variant="caption" style={[styles.label, { color: colors.subtle }]}>
        Top Tracks
      </Text>
      {tracks.map((track) => (
        <PreviewTrackRow
          key={track.id}
          track={track}
          isPlaying={playingId === track.id}
          isLoading={loadingId === track.id}
          progress={playingId === track.id ? progress : 0}
          onToggle={() => {
            void Haptics.selectionAsync();
            onToggle(track);
          }}
          onAdd={onAddToPlaylist ? () => onAddToPlaylist(track) : undefined}
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
  label: {
    ...Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
  },
});
