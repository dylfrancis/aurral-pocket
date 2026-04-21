import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { PreviewTrack } from "@/lib/types/library";

type PreviewTrackRowProps = {
  track: PreviewTrack;
  isPlaying: boolean;
  progress: number;
  onToggle: () => void;
};

export const PreviewTrackRow = React.memo(function PreviewTrackRow({
  track,
  isPlaying,
  progress,
  onToggle,
}: PreviewTrackRowProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View
        style={[
          styles.playButton,
          { backgroundColor: isPlaying ? colors.brand : colors.separator },
        ]}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={14}
          color={isPlaying ? "#fff" : colors.text}
          style={isPlaying ? undefined : styles.playIcon}
        />
      </View>
      <View style={styles.meta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.title, isPlaying && { color: colors.brandStrong }]}
        >
          {track.title}
        </Text>
        {track.album && (
          <Text variant="caption" numberOfLines={1}>
            {track.album}
          </Text>
        )}
        {isPlaying && (
          <View
            style={[styles.progressBar, { backgroundColor: colors.separator }]}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: colors.brand },
              ]}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    marginLeft: 2,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.medium,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
  },
});
