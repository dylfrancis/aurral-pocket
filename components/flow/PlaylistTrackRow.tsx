import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { PlayingBars } from "@/components/library/TrackRow";
import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { Text } from "@/components/ui/Text";
import { StatusBadge } from "./StatusBadge";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useCurrentTrack, usePlaybackState } from "@/lib/player/player";
import type { FlowJob } from "@/lib/types/flow";

type Props = {
  job: FlowJob;
  position: number;
  onPress?: () => void;
  onMenuPress?: () => void;
};

export const PlaylistTrackRow = React.memo(function PlaylistTrackRow({
  job,
  position,
  onPress,
  onMenuPress,
}: Props) {
  const colors = Colors[useColorScheme()];
  const isCurrent = useCurrentTrack()?.id === job.id;
  const playbackState = usePlaybackState();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMenuPress}
      disabled={!onPress && !onMenuPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.separator },
        pressed && onPress ? { opacity: 0.6 } : null,
      ]}
    >
      <View style={styles.indexSlot}>
        {isCurrent ? (
          <PlayingBars
            animating={playbackState === "playing"}
            color={colors.brand}
          />
        ) : (
          <Text
            variant="caption"
            style={[styles.number, { color: colors.subtle }]}
          >
            {position}
          </Text>
        )}
      </View>
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
      {job.status !== "done" ? <StatusBadge status={job.status} /> : null}
      {onMenuPress ? (
        <TrackMenuButton trackName={job.trackName} onPress={onMenuPress} />
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  indexSlot: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    ...Fonts.medium,
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
