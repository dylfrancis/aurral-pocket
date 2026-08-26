import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { Track } from "@/lib/types/library";

type TrackRowProps = {
  track: Track;
  onPress?: () => void;
  onLongPress?: () => void;
};

export const TrackRow = React.memo(function TrackRow({
  track,
  onPress,
  onLongPress,
}: TrackRowProps) {
  const colors = Colors[useColorScheme()];

  // Every tap reaches the screen, including a tap on a track with no
  // streamPath. The screen explains why that one cannot play. Swallowing the
  // tap here would make an unplayable track look like a broken player.
  const interactive = !!onPress || !!onLongPress;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!interactive}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.separator },
        pressed && interactive ? { opacity: 0.6 } : null,
      ]}
    >
      <Text variant="caption" style={[styles.number, { color: colors.subtle }]}>
        {track.trackNumber}
      </Text>
      <Text variant="body" numberOfLines={1} style={styles.title}>
        {track.trackName}
      </Text>
      {track.hasFile && track.quality && (
        <View
          style={[
            styles.qualityBadge,
            { backgroundColor: `${colors.brand}20` },
          ]}
        >
          <Text
            variant="caption"
            style={[styles.qualityText, { color: colors.brand }]}
          >
            {track.quality}
          </Text>
        </View>
      )}
      <Ionicons
        name={track.hasFile ? "checkmark-circle" : "remove-circle-outline"}
        size={16}
        color={track.hasFile ? colors.brand : colors.subtle}
      />
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
    gap: 10,
  },
  number: {
    width: 24,
    textAlign: "right",
    ...Fonts.medium,
  },
  title: {
    flex: 1,
  },
  qualityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  qualityText: {
    fontSize: 10,
    ...Fonts.medium,
  },
});
