import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import {
  formatDistance,
  formatShowArtists,
  getEventUrl,
  joinMeta,
  showTitle,
  titleNamesArtists,
} from "@/lib/discover/nearby-shows";
import { formatShowDateLabel } from "@/lib/discover/show-dates";
import type { ConcertEvent } from "@/lib/types/search";

type Props = {
  show: ConcertEvent;
  onPress: (show: ConcertEvent) => void;
};

/** The first show on the Shows page, large, with its ticket link. */
export function ShowLead({ show, onPress }: Props) {
  const colors = useColors();
  useDateTimeFormat();

  const title = showTitle(show);
  const artistNames = show.artistNames.filter(Boolean);
  const byline = titleNamesArtists(title, artistNames)
    ? null
    : formatShowArtists(show);
  const place = [show.city, show.region].filter(Boolean).join(", ");
  const where = joinMeta(show.venueName, place, formatDistance(show.distance));
  const date = formatShowDateLabel(show);
  const hasLink = !!getEventUrl(show.url);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={hasLink ? () => onPress(show) : undefined}
        accessible={false}
        style={({ pressed }) => [
          styles.art,
          { backgroundColor: colors.surfaceMid, opacity: pressed ? 0.85 : 1 },
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
            size={36}
            color={colors.subtle}
          />
        )}
      </Pressable>
      <View style={styles.body}>
        <Text
          variant="title"
          accessibilityRole="header"
          style={[styles.title, { color: colors.text }]}
          numberOfLines={3}
        >
          {title}
        </Text>
        {!!byline && (
          <Text variant="body" style={{ color: colors.subtle }}>
            {byline}
          </Text>
        )}
        {!!date && (
          <Text variant="body" style={{ color: colors.subtle }}>
            {date}
          </Text>
        )}
        {!!where && (
          <Text variant="body" style={{ color: colors.subtle }}>
            {where}
          </Text>
        )}
        {hasLink ? (
          <Button
            title="Get Tickets"
            onPress={() => onPress(show)}
            accessibilityLabel={`Get tickets for ${title}`}
            style={styles.action}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  art: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    alignItems: "flex-start",
    gap: 4,
  },
  title: {
    ...Fonts.bold,
    fontSize: 22,
    lineHeight: 27,
  },
  action: {
    width: "auto",
    height: 44,
    paddingHorizontal: 24,
    marginTop: 10,
  },
});
