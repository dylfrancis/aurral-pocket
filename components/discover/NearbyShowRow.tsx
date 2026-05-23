import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Chip } from "@/components/ui/Chip";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatShowDateLabel } from "@/lib/discover/show-dates";
import type { ConcertEvent } from "@/lib/types/search";

type Props = {
  show: ConcertEvent;
  onPress: () => void;
};

function DistancePill({ distance }: { distance: number }) {
  return (
    <View style={styles.distancePill}>
      <Text variant="caption" style={styles.distancePillText}>
        {`${Math.round(distance)} MI`}
      </Text>
    </View>
  );
}

function SourceBadge({ sourceType }: { sourceType?: string }) {
  if (sourceType !== "library" && sourceType !== "recommended") return null;
  return (
    <View style={styles.sourceBadgeWrap}>
      <Chip
        label={sourceType === "library" ? "Library" : "Recommended"}
        variant={sourceType === "library" ? "brand" : "subtle"}
        size="sm"
      />
    </View>
  );
}

function NearbyShowRowComponent({ show, onPress }: Props) {
  const colors = Colors[useColorScheme()];

  const dateLabel = formatShowDateLabel(show);
  const venueLine = [
    show.venueName,
    [show.city, show.region].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" – ");

  const hasDistance = Number.isFinite(show.distance);
  const hasArtistSubtitle =
    !!show.eventName && show.eventName !== show.artistName;
  const title = show.eventName || show.artistName;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.separator,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.imageWrap, { backgroundColor: colors.background }]}>
        {show.image ? (
          <Image
            source={{ uri: show.image }}
            style={styles.image}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={[styles.imageFallback, { borderColor: colors.separator }]}
          >
            <Ionicons
              name="musical-notes-outline"
              size={28}
              color={colors.subtle}
            />
          </View>
        )}
        {hasDistance && <DistancePill distance={show.distance as number} />}
      </View>
      <View style={styles.content}>
        {hasArtistSubtitle && (
          <Text
            variant="caption"
            style={[styles.artist, { color: colors.subtle }]}
            numberOfLines={1}
          >
            {show.artistName}
          </Text>
        )}
        <Text
          variant="body"
          style={[
            styles.title,
            { color: colors.text, fontFamily: Fonts.semiBold },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {!!dateLabel && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={colors.subtle} />
            <Text
              variant="caption"
              style={[styles.metaText, { color: colors.subtle }]}
              numberOfLines={1}
            >
              {dateLabel}
            </Text>
          </View>
        )}
        {!!venueLine && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.subtle} />
            <Text
              variant="caption"
              style={[styles.metaText, { color: colors.subtle }]}
              numberOfLines={1}
            >
              {venueLine}
            </Text>
          </View>
        )}
        <SourceBadge sourceType={show.matchType} />
      </View>
    </Pressable>
  );
}

export const NearbyShowRow = memo(NearbyShowRowComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  imageWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: 16 / 9,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    width: "100%",
    height: "100%",
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  distancePill: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  distancePillText: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: "#FFFFFF",
    fontFamily: Fonts.semiBold,
  },
  content: {
    padding: 14,
    gap: 6,
  },
  artist: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: Fonts.medium,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
  },
  sourceBadgeWrap: {
    flexDirection: "row",
    marginTop: 2,
  },
});
