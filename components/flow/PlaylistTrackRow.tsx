import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { TrackIndexSlot } from "@/components/library/TrackIndexSlot";
import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { TrackMenu } from "@/components/player/TrackMenu";
import type {
  TrackMenuAction,
  TrackMenuActionId,
} from "@/components/player/track-menu-types";
import { Text } from "@/components/ui/Text";
import { StatusBadge } from "./StatusBadge";
import { useTrackPlayback } from "@/hooks/player/use-track-playback";
import { SavedTrackMark } from "@/components/offline/SavedMark";
import { IS_IOS } from "@/constants/platform";
import type { FlowJob } from "@/lib/types/flow";
import { useColors } from "@/hooks/use-colors";

const COVER_SIZE = 44;

type Props = {
  job: FlowJob;
  position: number;
  onPress?: () => void;
  /** The native menu's actions. Unused when `onMenuPress` opens a sheet. */
  menuActions: TrackMenuAction[];
  onMenuAction: (job: FlowJob, id: TrackMenuActionId) => void;
  /** Opens the track's sheet from ⋯ and from a long press. */
  onMenuPress?: (job: FlowJob) => void;
  /** Shows ↓ once the track is on the phone. */
  markSaved?: boolean;
};

export const PlaylistTrackRow = React.memo(function PlaylistTrackRow({
  job,
  position,
  onPress,
  menuActions,
  onMenuAction,
  onMenuPress,
  markSaved = false,
}: Props) {
  const colors = useColors();
  const { isCurrent, isPlaying } = useTrackPlayback(job.id);

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      {/* The menu sits outside the pressable, so opening it can't also play
          the track. */}
      <Pressable
        onPress={onPress}
        onLongPress={onMenuPress ? () => onMenuPress(job) : undefined}
        disabled={!onPress && !onMenuPress}
        style={({ pressed }) => [
          styles.content,
          pressed && onPress ? { opacity: 0.6 } : null,
        ]}
      >
        <TrackIndexSlot
          number={position}
          isCurrent={isCurrent}
          isPlaying={isPlaying}
        />
        <CoverArtImage
          type="album"
          mbid={job.albumMbid ?? ""}
          coverUrl={job.artworkUrl}
          hints={{
            artistName: job.artistName,
            albumTitle: job.albumName ?? undefined,
          }}
          size={COVER_SIZE}
          borderRadius={6}
        />
        <View style={styles.body}>
          <Text
            variant="body"
            numberOfLines={1}
            style={isCurrent ? { color: colors.brand } : undefined}
          >
            {job.trackName}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {job.albumName
              ? `${job.artistName} · ${job.albumName}`
              : job.artistName}
          </Text>
        </View>
        {markSaved ? <SavedTrackMark trackId={job.id} /> : null}
        {job.status !== "done" ? <StatusBadge status={job.status} /> : null}
      </Pressable>
      {onMenuPress ? (
        <View style={[styles.menu, styles.menuSlot, styles.menuButton]}>
          <TrackMenuButton
            trackName={job.trackName}
            onPress={() => onMenuPress(job)}
          />
        </View>
      ) : menuActions.length > 0 ? (
        <View style={styles.menu}>
          <TrackMenu
            compact
            actions={menuActions}
            onAction={(id) => onMenuAction(job, id)}
            triggerColor={colors.subtle}
            accessibilityLabel={`More actions for ${job.trackName}`}
          />
        </View>
      ) : (
        // Keeps this row's chip in line with rows that have a menu.
        <View style={[styles.menu, styles.menuSlot]} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  // The target is wider than its glyph, so it overlaps the row's padding to
  // keep the glyph near the edge.
  menu: {
    marginRight: -12,
  },
  menuSlot: {
    width: IS_IOS ? 44 : 48,
  },
  // Centered where the native menu's glyph sits.
  menuButton: {
    alignItems: "center",
    justifyContent: "center",
  },
});
