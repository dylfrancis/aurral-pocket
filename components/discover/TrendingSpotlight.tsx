import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts, Radius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { TrendingChartSong, TrendingSpotlight } from "@/lib/types/search";

const COVER_SIZE = 112;
const LINE_HEIGHT = 56;
const LINE_PAD = 6;

type Props = {
  song: TrendingChartSong;
  spotlight: TrendingSpotlight | null;
  isPlaying: boolean;
  isLoading: boolean;
  isLookingUpLink: boolean;
  onTogglePreview: () => void;
  onOpenArtist: () => void;
  onOpenAlbum: () => void;
};

export function TrendingSpotlightCard({
  song,
  spotlight,
  isPlaying,
  isLoading,
  isLookingUpLink,
  onTogglePreview,
  onOpenArtist,
  onOpenAlbum,
}: Props) {
  const colors = Colors[useColorScheme()];
  // As on the web: a single's album is named after it, so it says nothing new.
  const showAlbum = !!song.albumName && song.albumName !== song.trackName;

  return (
    <Card bordered style={styles.card}>
      <View style={styles.top}>
        <CoverArtImage
          type="album"
          mbid=""
          coverUrl={song.largeArtworkUrl ?? song.artworkUrl}
          size={COVER_SIZE}
          borderRadius={10}
        />
        <View style={styles.body}>
          <Text
            variant="caption"
            style={[styles.eyebrow, { color: colors.brand }]}
          >
            No. 1
          </Text>
          <Text variant="body" numberOfLines={2} style={styles.title}>
            {song.trackName}
          </Text>
          <Pressable
            onPress={onOpenArtist}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="link"
            accessibilityLabel={`Open artist ${song.artistName}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Text variant="caption" numberOfLines={1}>
              {song.artistName}
            </Text>
          </Pressable>
          {showAlbum ? (
            <Pressable
              onPress={onOpenAlbum}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="link"
              accessibilityLabel={`Open album ${song.albumName}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text variant="caption" numberOfLines={1}>
                {song.albumName}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.actions}>
            {song.preview_url ? (
              <Pressable
                onPress={onTogglePreview}
                accessibilityRole="button"
                accessibilityLabel={`${isPlaying ? "Pause" : "Preview"} ${song.trackName}`}
                style={({ pressed }) => [
                  styles.previewButton,
                  { backgroundColor: colors.brand, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.buttonPrimaryText}
                  />
                ) : (
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={14}
                    color={colors.buttonPrimaryText}
                  />
                )}
                <Text
                  variant="caption"
                  style={[
                    styles.previewLabel,
                    { color: colors.buttonPrimaryText },
                  ]}
                >
                  {isPlaying ? "Pause" : "Preview"}
                </Text>
              </Pressable>
            ) : null}
            {isLookingUpLink ? (
              <ActivityIndicator size="small" color={colors.subtle} />
            ) : null}
          </View>
        </View>
      </View>
      {spotlight ? (
        <View style={[styles.trend, { borderTopColor: colors.separator }]}>
          <Text variant="body" style={styles.stat}>
            {spotlight.daysAtTop} {spotlight.daysAtTop === 1 ? "day" : "days"}{" "}
            <Text variant="caption">at No. 1</Text>
          </Text>
          <RankLine ranks={spotlight.ranks} />
          <Text variant="caption" style={styles.lineCaption}>
            Rank, last {spotlight.ranks.length} days
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function RankLine({ ranks }: { ranks: (number | null)[] }) {
  const colors = Colors[useColorScheme()];
  const [width, setWidth] = useState(0);

  const chartedDays = ranks.filter((rank) => rank !== null).length;
  const bottomRank = Math.max(10, ...ranks.map((rank) => rank ?? 0));
  const x = (index: number) =>
    LINE_PAD + ((width - LINE_PAD * 2) * index) / Math.max(1, ranks.length - 1);
  const y = (rank: number) =>
    LINE_PAD + ((LINE_HEIGHT - LINE_PAD * 2) * (rank - 1)) / (bottomRank - 1);
  // A day off the chart breaks the line rather than bridging the gap.
  const path = ranks
    .map((rank, index) => {
      if (rank === null) return "";
      const command = index > 0 && ranks[index - 1] !== null ? "L" : "M";
      return `${command}${x(index).toFixed(1)},${y(rank).toFixed(1)}`;
    })
    .join(" ");
  const lastIndex = ranks.findLastIndex((rank) => rank !== null);
  const lastRank = lastIndex === -1 ? null : ranks[lastIndex];

  return (
    <View
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Charted ${chartedDays} of the last ${ranks.length} days`}
      style={styles.line}
    >
      {width > 0 ? (
        <Svg width={width} height={LINE_HEIGHT}>
          <Line
            x1={LINE_PAD}
            x2={width - LINE_PAD}
            y1={LINE_PAD}
            y2={LINE_PAD}
            stroke={colors.separator}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <Path
            d={path}
            stroke={colors.brand}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* A day with no charted neighbour has no line to sit on. */}
          {ranks.map((rank, index) =>
            rank !== null &&
            index !== lastIndex &&
            ranks[index - 1] == null &&
            ranks[index + 1] == null ? (
              <Circle
                key={index}
                cx={x(index)}
                cy={y(rank)}
                r={2.5}
                fill={colors.brand}
              />
            ) : null,
          )}
          {lastRank !== null ? (
            <Circle
              cx={x(lastIndex)}
              cy={y(lastRank)}
              r={4}
              fill={colors.brand}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    gap: 12,
  },
  top: {
    flexDirection: "row",
    gap: 14,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    ...Fonts.semiBold,
    fontSize: 18,
    lineHeight: 23,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.round,
  },
  previewLabel: {
    ...Fonts.semiBold,
  },
  trend: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 4,
  },
  stat: {
    ...Fonts.semiBold,
  },
  line: {
    height: LINE_HEIGHT,
  },
  lineCaption: {
    fontSize: 12,
  },
});
