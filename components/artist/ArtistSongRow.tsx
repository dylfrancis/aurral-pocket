import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { TrackIndexSlot } from "@/components/library/TrackIndexSlot";
import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { PreviewTag } from "@/components/ui/PreviewTag";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import type { TopTrack } from "@/lib/top-tracks";
import type { AlbumTrack } from "@/lib/types/library";

const COVER_SIZE = 44;

/** What a numbered row on an artist's song lists shows. */
export type ArtistSong = {
  key: string;
  title: string;
  album: string | null;
  coverUrl: string | null | undefined;
  albumMbid: string;
  /** A clip, not a Library file. */
  isPreview: boolean;
};

export function topTrackSong({ preview, library }: TopTrack): ArtistSong {
  return {
    key: preview.id,
    title: library?.title ?? preview.title,
    album: library?.album || preview.album,
    coverUrl: library?.artworkUrl ?? preview.artworkUrl,
    albumMbid: library?.albumMbid ?? "",
    isPreview: !library,
  };
}

export function librarySong(track: AlbumTrack): ArtistSong {
  return {
    key: track.id,
    title: track.trackName,
    album: track.album?.albumName ?? null,
    coverUrl: track.album?.coverUrl,
    albumMbid: track.album?.mbid ?? "",
    isPreview: false,
  };
}

type ArtistSongRowProps = {
  song: ArtistSong;
  number: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPress: () => void;
  onOpenActions: () => void;
};

export const ArtistSongRow = React.memo(function ArtistSongRow({
  song,
  number,
  isCurrent,
  isPlaying,
  onPress,
  onOpenActions,
}: ArtistSongRowProps) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        song.isPreview ? `${song.title}, preview` : song.title
      }
      onPress={onPress}
      onLongPress={onOpenActions}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <TrackIndexSlot
        number={number}
        isCurrent={isCurrent}
        isPlaying={isPlaying}
      />
      <CoverArtImage
        type="album"
        mbid={song.albumMbid}
        coverUrl={song.coverUrl}
        size={COVER_SIZE}
        borderRadius={4}
      />
      <View style={styles.meta}>
        <View style={styles.titleLine}>
          <Text
            variant="body"
            numberOfLines={1}
            style={[
              styles.title,
              { color: isCurrent ? colors.brandStrong : colors.text },
            ]}
          >
            {song.title}
          </Text>
          {song.isPreview ? <PreviewTag /> : null}
        </View>
        {song.album ? (
          <Text variant="caption" numberOfLines={1}>
            {song.album}
          </Text>
        ) : null}
      </View>
      <TrackMenuButton trackName={song.title} onPress={onOpenActions} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    ...Fonts.medium,
    flexShrink: 1,
  },
});
