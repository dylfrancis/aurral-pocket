import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatShowArtists } from "@/lib/discover/nearby-shows";
import { formatShowDateLabel } from "@/lib/discover/show-dates";
import type { ConcertEvent, NearbyShowSource } from "@/lib/types/search";

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

/** A show with a library artist reads as Library, whatever else matched. */
function SourceBadge({ sourceTypes }: { sourceTypes: NearbyShowSource[] }) {
  const isLibrary = sourceTypes.includes("library");
  if (!isLibrary && !sourceTypes.includes("recommended")) return null;
  return (
    <View style={styles.sourceBadgeWrap}>
      <Chip
        label={isLibrary ? "Library" : "Recommended"}
        variant={isLibrary ? "brand" : "subtle"}
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
  const artists = formatShowArtists(show);
  const hasArtistSubtitle =
    !!show.eventName && !!artists && show.eventName !== artists;
  const title = show.eventName || artists;

  return (
    <Card onPress={onPress} bordered pressedOpacity={0.85} style={styles.card}>
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
            {artists}
          </Text>
        )}
        <Text
          variant="body"
          style={[styles.title, { color: colors.text, ...Fonts.semiBold }]}
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
        <SourceBadge sourceTypes={show.sourceTypes} />
      </View>
    </Card>
  );
}

export const NearbyShowRow = memo(NearbyShowRowComponent);

const styles = StyleSheet.create({
  card: {
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
    ...Fonts.semiBold,
  },
  content: {
    padding: 14,
    gap: 6,
  },
  artist: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    ...Fonts.medium,
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
