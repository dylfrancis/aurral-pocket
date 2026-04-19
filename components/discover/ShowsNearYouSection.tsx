import { StyleSheet, View, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { useNearbyShows } from "@/hooks/discover";
import type { ConcertEvent } from "@/lib/types/search";
import { Skeleton } from "@/components/ui/Skeleton";

type Props = {
  onShowPress: (show: ConcertEvent) => void;
  onOpenSettings: () => void;
};

const CARD_WIDTH = 240;

function formatShowDate(show: ConcertEvent) {
  if (!show.date && !show.dateTime) return null;
  const raw = show.dateTime || show.date || "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return show.date || null;
  const dateLabel = parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return show.time ? `${dateLabel} at ${show.time}` : dateLabel;
}

function formatShowLocation(show: ConcertEvent) {
  return [show.venueName, [show.city, show.region].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" — ");
}

export function ShowsNearYouSection({ onShowPress, onOpenSettings }: Props) {
  const colors = Colors[useColorScheme()];
  const { data, isLoading } = useNearbyShows();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Shows Near You
        </Text>
        <View style={styles.skeletons}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton
              key={i}
              width={CARD_WIDTH}
              height={180}
              borderRadius={12}
            />
          ))}
        </View>
      </View>
    );
  }

  if (data?.configured === false) {
    return (
      <View style={styles.container}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Shows Near You
        </Text>
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: colors.card, borderColor: colors.separator },
          ]}
        >
          <Text
            variant="body"
            style={[
              styles.emptyTitle,
              { color: colors.text, fontFamily: Fonts.semiBold },
            ]}
          >
            Ticketmaster not configured
          </Text>
          <Text
            variant="caption"
            style={[styles.emptyBody, { color: colors.subtle }]}
          >
            Add a Ticketmaster Consumer Key in Settings to see local shows.
          </Text>
          <Pressable
            onPress={onOpenSettings}
            style={[styles.emptyButton, { backgroundColor: colors.brand }]}
          >
            <Text
              variant="caption"
              style={{ color: colors.background, fontFamily: Fonts.semiBold }}
            >
              Open Settings
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const shows = data?.shows ?? [];
  if (shows.length === 0) return null;

  const locationLabel =
    data?.location?.label || data?.location?.postalCode || "your area";

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Shows Near You
        </Text>
        <Text
          variant="caption"
          style={[styles.locationPill, { color: colors.subtle }]}
        >
          {locationLabel}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {shows.slice(0, 8).map((show) => {
          const date = formatShowDate(show);
          const where = formatShowLocation(show);
          return (
            <Pressable
              key={`${show.id}-${show.artistName}`}
              style={({ pressed }) => [
                styles.showCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.separator,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => onShowPress(show)}
            >
              <View style={styles.showHeader}>
                <Text
                  variant="caption"
                  style={[styles.showArtist, { color: colors.subtle }]}
                  numberOfLines={1}
                >
                  {show.artistName}
                </Text>
                {Number.isFinite(show.distance) && (
                  <Text
                    variant="caption"
                    style={[styles.showDistance, { color: colors.subtle }]}
                  >
                    {Math.round(show.distance as number)} mi
                  </Text>
                )}
              </View>
              <Text
                variant="body"
                style={[
                  styles.showTitle,
                  { color: colors.text, fontFamily: Fonts.semiBold },
                ]}
                numberOfLines={2}
              >
                {show.eventName || show.artistName}
              </Text>
              {!!date && (
                <View style={styles.showRow}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={colors.subtle}
                  />
                  <Text
                    variant="caption"
                    style={[styles.showMeta, { color: colors.subtle }]}
                    numberOfLines={1}
                  >
                    {date}
                  </Text>
                </View>
              )}
              {!!where && (
                <View style={styles.showRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={colors.subtle}
                  />
                  <Text
                    variant="caption"
                    style={[styles.showMeta, { color: colors.subtle }]}
                    numberOfLines={2}
                  >
                    {where}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  label: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
    marginBottom: 4,
  },
  locationPill: {
    fontSize: 12,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  skeletons: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  showCard: {
    width: CARD_WIDTH,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  showHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  showArtist: {
    flex: 1,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  showDistance: {
    fontSize: 11,
  },
  showTitle: {
    fontSize: 14,
  },
  showRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  showMeta: {
    flex: 1,
    fontSize: 12,
  },
  emptyCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
