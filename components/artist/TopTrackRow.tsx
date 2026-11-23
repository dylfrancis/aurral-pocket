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

const COVER_SIZE = 44;

type TopTrackRowProps = {
  topTrack: TopTrack;
  number: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPress: () => void;
  onOpenActions: () => void;
};

export const TopTrackRow = React.memo(function TopTrackRow({
  topTrack,
  number,
  isCurrent,
  isPlaying,
  onPress,
  onOpenActions,
}: TopTrackRowProps) {
  const colors = useColors();
  const { preview, library } = topTrack;
  const title = library?.title ?? preview.title;
  const album = library?.album || preview.album;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={library ? title : `${title}, preview`}
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
        mbid={library?.albumMbid ?? ""}
        coverUrl={library?.artworkUrl ?? preview.artworkUrl}
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
            {title}
          </Text>
          {library ? null : <PreviewTag />}
        </View>
        {album ? (
          <Text variant="caption" numberOfLines={1}>
            {album}
          </Text>
        ) : null}
      </View>
      <TrackMenuButton trackName={title} onPress={onOpenActions} />
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
