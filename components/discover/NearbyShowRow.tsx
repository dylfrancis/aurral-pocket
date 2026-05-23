import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  formatCalendarTile,
  formatShowTime,
  parseShowDate,
} from "@/lib/discover/show-dates";
import type { ConcertEvent } from "@/lib/types/search";

type Props = {
  show: ConcertEvent;
  onPress: () => void;
};

const TILE_SIZE = 64;

function CalendarTile({ show }: { show: ConcertEvent }) {
  const colors = Colors[useColorScheme()];
  const date = parseShowDate(show);

  if (!date) {
    return (
      <View
        style={[
          styles.tile,
          { backgroundColor: colors.card, borderColor: colors.separator },
        ]}
      >
        <Text
          variant="caption"
          style={[styles.tileMonth, { color: colors.subtle }]}
        >
          TBA
        </Text>
      </View>
    );
  }

  const { month, day, weekday } = formatCalendarTile(date);

  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: colors.card, borderColor: colors.separator },
      ]}
    >
      <Text
        variant="caption"
        style={[
          styles.tileMonth,
          { color: colors.brand, fontFamily: Fonts.semiBold },
        ]}
      >
        {month}
      </Text>
      <Text
        variant="title"
        style={[
          styles.tileDay,
          { color: colors.text, fontFamily: Fonts.semiBold },
        ]}
      >
        {day}
      </Text>
      <Text
        variant="caption"
        style={[styles.tileWeekday, { color: colors.subtle }]}
      >
        {weekday}
      </Text>
    </View>
  );
}

function SourceBadge({ sourceType }: { sourceType?: string }) {
  const colors = Colors[useColorScheme()];
  if (sourceType !== "library" && sourceType !== "recommended") return null;
  const label = sourceType === "library" ? "Library" : "Recommended";
  const tint = sourceType === "library" ? colors.brand : colors.subtle;
  return (
    <View style={[styles.badge, { borderColor: tint }]}>
      <Text variant="caption" style={[styles.badgeText, { color: tint }]}>
        {label}
      </Text>
    </View>
  );
}

function NearbyShowRowComponent({ show, onPress }: Props) {
  const colors = Colors[useColorScheme()];
  const time = formatShowTime(show);
  const venue = show.venueName || "";
  const cityRegion = [show.city, show.region].filter(Boolean).join(", ");
  const distance = Number.isFinite(show.distance)
    ? `${Math.round(show.distance as number)} mi`
    : "";

  const title = show.eventName || show.artistName;
  const subtitle =
    show.eventName && show.eventName !== show.artistName
      ? show.artistName
      : null;

  const metaParts = [time, venue].filter(Boolean);
  const locationParts = [cityRegion, distance].filter(Boolean);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.separator,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <CalendarTile show={show} />
      <View style={styles.content}>
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
        {!!subtitle && (
          <Text
            variant="caption"
            style={[styles.subtitle, { color: colors.subtle }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
        {metaParts.length > 0 && (
          <Text
            variant="caption"
            style={[styles.meta, { color: colors.subtle }]}
            numberOfLines={1}
          >
            {metaParts.join(" · ")}
          </Text>
        )}
        <View style={styles.footer}>
          {locationParts.length > 0 && (
            <Text
              variant="caption"
              style={[styles.meta, { color: colors.subtle }]}
              numberOfLines={1}
            >
              {locationParts.join(" · ")}
            </Text>
          )}
          <SourceBadge sourceType={show.matchType} />
        </View>
      </View>
    </Pressable>
  );
}

export const NearbyShowRow = memo(NearbyShowRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tileMonth: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  tileDay: {
    fontSize: 22,
    lineHeight: 26,
  },
  tileWeekday: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
  },
  subtitle: {
    fontSize: 12,
  },
  meta: {
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
});
