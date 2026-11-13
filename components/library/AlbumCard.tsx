import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SavedMark, albumSavedId } from "@/components/offline/SavedMark";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "./CoverArtImage";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { formatReleaseWait } from "@/lib/album-status";
import { Colors, Fonts } from "@/constants/theme";
import type { Album, DownloadStatusValue } from "@/lib/types/library";

const CARD_WIDTH = 150;

const STATUS_LABELS: Record<string, string> = {
  adding: "Adding...",
  searching: "Searching...",
  downloading: "Downloading...",
  moving: "Moving...",
  processing: "Processing...",
  queued: "Queued",
  blocked: "Needs attention",
  cancelled: "Cancelled",
  failed: "Failed",
};

type AlbumCardProps = {
  album: Album;
  onPress: () => void;
  fill?: boolean;
  downloadStatus?: DownloadStatusValue;
  /** Adds the artist under the album name, for grids that mix artists. */
  showArtist?: boolean;
  /** The save this card stands for, when a list draws saves. */
  savedId?: string;
};

export const AlbumCard = React.memo(function AlbumCard({
  album,
  onPress,
  fill,
  downloadStatus,
  showArtist = false,
  savedId,
}: AlbumCardProps) {
  const colors = Colors[useColorScheme()];
  // This card is memoized, so subscribe here: a changed server format has to
  // repaint the release date even when the album props stay the same.
  useDateTimeFormat();

  const year = album.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;

  const { trackCount, percentOfTracks } = album.statistics;
  const percent = Math.round(percentOfTracks);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        fill ? styles.containerFill : styles.container,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <CoverArtImage
        type="album"
        mbid={album.mbid}
        coverUrl={album.coverUrl}
        size={fill ? "fill" : CARD_WIDTH}
        borderRadius={10}
      />
      <View style={styles.meta}>
        <Text variant="body" numberOfLines={2} style={styles.albumName}>
          {album.albumName}
        </Text>
        {showArtist && (
          <Text variant="caption" numberOfLines={1}>
            {album.artistName || "Unknown Artist"}
          </Text>
        )}
        {downloadStatus === "unreleased" && percent < 100 ? (
          // The date already names the year, and a card is too narrow for
          // the track count beside it.
          <Text variant="caption" numberOfLines={1}>
            {formatReleaseWait(album.releaseDate)}
          </Text>
        ) : (
          <Text variant="caption" numberOfLines={1}>
            <SavedMark
              kind="album"
              id={savedId ?? albumSavedId(album)}
              size={12}
              inline
            />
            {year && `${year} · `}
            {trackCount} {trackCount === 1 ? "track" : "tracks"}
            {" · "}
            <Text
              variant="caption"
              style={{
                color:
                  percent === 100
                    ? colors.brandStrong
                    : downloadStatus === "failed"
                      ? colors.error
                      : colors.subtle,
              }}
            >
              {downloadStatus && percent < 100
                ? (STATUS_LABELS[downloadStatus] ?? `${percent}%`)
                : `${percent}%`}
            </Text>
          </Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginRight: 12,
  },
  containerFill: {
    flex: 1,
  },
  meta: {
    paddingTop: 6,
    gap: 2,
  },
  albumName: {
    ...Fonts.medium,
    fontSize: 13,
    lineHeight: 17,
  },
});
