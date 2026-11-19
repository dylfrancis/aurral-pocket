import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { TrackIndexSlot } from "@/components/library/TrackIndexSlot";
import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { Text } from "@/components/ui/Text";
import { useColors } from "@/hooks/use-colors";
import { useTrackPlayback } from "@/hooks/player/use-track-playback";
import type { EditorialTrackItem } from "./EditorialTrackRow";

const COVER_SIZE = 44;
const MISSING_OPACITY = 0.45;

export type TrackDownloadState = "idle" | "sending" | "queued";

type Props = {
  item: EditorialTrackItem;
  position: number;
  /** The id the player knows the row's sound by. */
  playerId: string;
  isLookingUpLink: boolean;
  onPress: (item: EditorialTrackItem) => void;
  onOpenActions: (item: EditorialTrackItem) => void;
  onOpenArtist: (item: EditorialTrackItem) => void;
  onOpenAlbum: (item: EditorialTrackItem) => void;
  /** Omit when the listener can't ask for downloads. */
  onDownload?: (item: EditorialTrackItem) => void;
  downloadState?: TrackDownloadState;
};

/** One the Library doesn't have is grayed, with a ↓ to download it. */
export const BrowseTrackRow = React.memo(function BrowseTrackRow({
  item,
  position,
  playerId,
  isLookingUpLink,
  onPress,
  onOpenActions,
  onOpenArtist,
  onOpenAlbum,
  onDownload,
  downloadState = "idle",
}: Props) {
  const colors = useColors();
  const { track } = item;
  const owned = !!track.owned;
  const playable = owned || !!track.preview_url;
  const { isCurrent, isPlaying } = useTrackPlayback(playerId);

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      {/* The ↓ and ⋯ sit outside the pressable, so they can't also play. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          owned ? track.trackName : `${track.trackName}, not in your Library`
        }
        onPress={() => onPress(item)}
        onLongPress={() => onOpenActions(item)}
        disabled={!playable}
        style={({ pressed }) => [
          styles.content,
          { opacity: owned ? (pressed ? 0.6 : 1) : MISSING_OPACITY },
        ]}
      >
        <TrackIndexSlot
          number={position}
          isCurrent={isCurrent}
          isPlaying={isPlaying}
        />
        <CoverArtImage
          type="album"
          mbid=""
          coverUrl={track.owned?.artworkUrl ?? track.artworkUrl}
          size={COVER_SIZE}
          borderRadius={4}
        />
        <View style={styles.body}>
          <Text
            variant="body"
            numberOfLines={1}
            style={{ color: isCurrent ? colors.brandStrong : colors.text }}
          >
            {track.trackName}
          </Text>
          <View style={styles.links}>
            <TrackLink
              label={track.artistName}
              accessibilityLabel={`Open artist ${track.artistName}`}
              onPress={() => onOpenArtist(item)}
            />
            {track.albumName ? (
              <>
                <Text variant="caption"> · </Text>
                <TrackLink
                  label={track.albumName}
                  accessibilityLabel={`Open album ${track.albumName}`}
                  onPress={() => onOpenAlbum(item)}
                />
              </>
            ) : null}
          </View>
        </View>
        {isLookingUpLink ? (
          <ActivityIndicator size="small" color={colors.subtle} />
        ) : null}
      </Pressable>
      {!owned && onDownload ? (
        <DownloadButton
          trackName={track.trackName}
          state={downloadState}
          onPress={() => onDownload(item)}
        />
      ) : null}
      <View style={styles.menu}>
        <TrackMenuButton
          trackName={track.trackName}
          onPress={() => onOpenActions(item)}
        />
      </View>
    </View>
  );
});

function DownloadButton({
  trackName,
  state,
  onPress,
}: {
  trackName: string;
  state: TrackDownloadState;
  onPress: () => void;
}) {
  const colors = useColors();
  if (state === "sending") {
    return (
      <View style={styles.download}>
        <ActivityIndicator size="small" color={colors.subtle} />
      </View>
    );
  }
  const queued = state === "queued";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        queued ? `${trackName} is downloading` : `Download ${trackName}`
      }
      accessibilityState={{ disabled: queued }}
      disabled={queued}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.download, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons
        name={queued ? "time-outline" : "arrow-down-circle-outline"}
        size={22}
        color={queued ? colors.subtle : colors.brand}
      />
    </Pressable>
  );
}

function TrackLink({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Text variant="caption" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

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
  links: {
    flexDirection: "row",
    alignItems: "center",
  },
  link: {
    flexShrink: 1,
  },
  download: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  // The target is wider than its glyph, so it overlaps the row's padding to
  // keep the glyph near the edge, as the Library playlist rows do.
  menu: {
    width: 32,
    alignItems: "center",
    marginRight: -8,
  },
});
