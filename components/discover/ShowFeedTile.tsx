import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { formatDate } from "@/lib/date-time";
import {
  formatDistance,
  formatShowArtists,
  getEventUrl,
  joinMeta,
  showTitle,
} from "@/lib/discover/nearby-shows";
import { formatShowTime, getShowDay } from "@/lib/discover/show-dates";
import type { DiscoverFeedStyle } from "@/lib/types/me";
import type { ConcertEvent } from "@/lib/types/search";

export const SQUARE_TILE_WIDTH = 160;
export const WIDE_TILE_WIDTH = 240;
const LIST_ART_SIZE = 48;
const ART_RADIUS = 10;

type Props = {
  show: ConcertEvent;
  feedStyle: DiscoverFeedStyle;
  onPress: (show: ConcertEvent) => void;
};

/**
 * One show in the web's feed styles: a dated row ("list"), a square tile, or a
 * 16:9 tile with the date on the image ("wide"). The title is who plays.
 */
function ShowFeedTileComponent({ show, feedStyle, onPress }: Props) {
  const colors = useColors();
  useDateTimeFormat();

  const title = formatShowArtists(show) || showTitle(show);
  const day = getShowDay(show);
  const distance = formatDistance(show.distance);
  const place =
    (show.venueName && show.city ? `${show.venueName}, ${show.city}` : null) ||
    show.venueName ||
    show.city;
  const weekday = day
    ? day.toLocaleDateString(undefined, { weekday: "short" })
    : null;
  const shortDate = day
    ? formatDate(day, { month: "short", day: "numeric" })
    : null;
  const meta =
    feedStyle === "list"
      ? joinMeta(place, weekday, formatShowTime(show.time))
      : feedStyle === "square"
        ? joinMeta(weekday, shortDate, show.city)
        : joinMeta(show.venueName || show.city, distance);

  const hasLink = !!getEventUrl(show.url);
  const pressProps = hasLink
    ? {
        onPress: () => onPress(show),
        accessibilityRole: "button" as const,
        accessibilityLabel: `Open tickets for ${showTitle(show)}`,
      }
    : {};

  const art = (overlay?: ReactNode) => (
    <View
      style={[
        styles.art,
        feedStyle === "list" && styles.listArt,
        feedStyle === "wide" && styles.wideArt,
        { backgroundColor: colors.surfaceMid },
      ]}
    >
      {show.image ? (
        <Image
          source={{ uri: show.image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Ionicons
          name="musical-notes-outline"
          size={feedStyle === "list" ? 20 : 28}
          color={colors.subtle}
        />
      )}
      {overlay}
    </View>
  );

  const text = (
    <View style={feedStyle === "list" ? styles.rowText : styles.tileText}>
      <Text
        variant="body"
        style={[styles.title, { color: colors.text }]}
        numberOfLines={2}
      >
        {title}
      </Text>
      {!!meta && (
        <Text
          variant="caption"
          style={[styles.meta, { color: colors.subtle }]}
          numberOfLines={1}
        >
          {meta}
        </Text>
      )}
    </View>
  );

  if (feedStyle === "list") {
    return (
      <Pressable
        {...pressProps}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={styles.dateBlock}>
          {day ? (
            <>
              <Text style={[styles.day, { color: colors.text }]}>
                {day.getDate()}
              </Text>
              <Text style={[styles.month, { color: colors.subtle }]}>
                {day.toLocaleDateString(undefined, { month: "short" })}
              </Text>
            </>
          ) : null}
        </View>
        {art()}
        {text}
        {distance ? (
          <Text style={[styles.distance, { color: colors.subtle }]}>
            {distance}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      {...pressProps}
      style={({ pressed }) => [
        { width: feedStyle === "wide" ? WIDE_TILE_WIDTH : SQUARE_TILE_WIDTH },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {art(
        feedStyle === "wide" && shortDate ? (
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.72)"]}
            style={styles.overlay}
          >
            <Text style={styles.overlayText}>{shortDate}</Text>
          </LinearGradient>
        ) : null,
      )}
      {text}
    </Pressable>
  );
}

export const ShowFeedTile = memo(ShowFeedTileComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  dateBlock: {
    width: 36,
    alignItems: "center",
    gap: 2,
  },
  day: {
    ...Fonts.bold,
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  month: {
    fontSize: 12,
    lineHeight: 14,
  },
  art: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: ART_RADIUS,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  listArt: {
    width: LIST_ART_SIZE,
    height: LIST_ART_SIZE,
    borderRadius: LIST_ART_SIZE / 2,
  },
  wideArt: {
    aspectRatio: 16 / 9,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  overlayText: {
    ...Fonts.bold,
    fontSize: 20,
    color: "#FFFFFF",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  tileText: {
    gap: 2,
    paddingTop: 8,
  },
  title: {
    ...Fonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
  distance: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
