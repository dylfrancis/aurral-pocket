import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useNearbyLocationPref, useNearbyShows } from "@/hooks/discover";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatShowDateLabel } from "@/lib/discover/show-dates";
import type { ConcertEvent } from "@/lib/types/search";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ViewAllCard } from "./ViewAllCard";

type Props = {
  onShowPress: (show: ConcertEvent) => void;
  onOpenSettings: () => void;
  onViewAll: () => void;
};

const CARD_WIDTH = 240;
const PREVIEW_LIMIT = 8;

function formatShowLocation(show: ConcertEvent) {
  return [show.venueName, [show.city, show.region].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" - ");
}

export function ShowsNearYouSection({
  onShowPress,
  onOpenSettings,
  onViewAll,
}: Props) {
  const colors = Colors[useColorScheme()];
  const { mode, appliedZip } = useNearbyLocationPref();

  const zipModeActive = mode === "zip";
  const zipQueryValue =
    zipModeActive && appliedZip.trim() ? appliedZip.trim() : undefined;

  const { data, isLoading } = useNearbyShows({
    zipCode: zipQueryValue,
    enabled: !zipModeActive || !!appliedZip.trim(),
  });

  const handleShowPress = useCallback(
    (show: ConcertEvent) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onShowPress(show);
    },
    [onShowPress],
  );

  const handleOpenSettings = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onOpenSettings();
  }, [onOpenSettings]);

  const handleViewAll = useCallback(() => {
    onViewAll();
  }, [onViewAll]);

  const locationLabel =
    data?.location?.label || data?.location?.postalCode || "";

  const header = (
    <SectionHeader title="Shows Near You" onNavigate={handleViewAll} />
  );

  const locationRow = data?.configured !== false && (
    <View style={styles.locationRow}>
      <Text
        variant="body"
        style={[styles.locationText, { color: colors.subtle }]}
        numberOfLines={1}
      >
        {locationLabel}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {header}
        {locationRow}
        <View style={styles.skeletons} testID="shows-near-you-skeleton">
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
        {header}
        <Card bordered style={styles.emptyCard}>
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
          <Button title="Open Settings" onPress={handleOpenSettings} />
        </Card>
      </View>
    );
  }

  if (zipModeActive && !appliedZip.trim()) {
    return (
      <View style={styles.container}>
        {header}
        <Card bordered style={styles.emptyCard}>
          <Text
            variant="body"
            style={[
              styles.emptyTitle,
              { color: colors.text, fontFamily: Fonts.semiBold },
            ]}
          >
            ZIP not set
          </Text>
          <Text
            variant="caption"
            style={[styles.emptyBody, { color: colors.subtle }]}
          >
            Enter a ZIP code on the Shows Near You page to search that area.
          </Text>
          <Button title="Open Shows Near You" onPress={handleViewAll} />
        </Card>
      </View>
    );
  }

  const shows = data?.shows ?? [];

  if (shows.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        {locationRow}
        <Card bordered style={styles.emptyCard}>
          <Text
            variant="body"
            style={[
              styles.emptyTitle,
              { color: colors.text, fontFamily: Fonts.semiBold },
            ]}
          >
            No upcoming nearby matches
          </Text>
          <Text
            variant="caption"
            style={[styles.emptyBody, { color: colors.subtle }]}
          >
            We could not find local Ticketmaster shows for artists from your
            library around {locationLabel}.
          </Text>
        </Card>
      </View>
    );
  }

  const hasMore = shows.length > PREVIEW_LIMIT;

  return (
    <View style={styles.container}>
      {header}
      {locationRow}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {shows.slice(0, PREVIEW_LIMIT).map((show) => {
          const date = formatShowDateLabel(show);
          const where = formatShowLocation(show);
          return (
            <Card
              key={`${show.id}-${show.artistName}`}
              bordered
              pressedOpacity={0.85}
              style={styles.showCard}
              onPress={() => handleShowPress(show)}
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
            </Card>
          );
        })}
        {hasMore ? (
          <ViewAllCard size={CARD_WIDTH * 0.6} onPress={handleViewAll} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 15,
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
    marginTop: 8,
  },
  showCard: {
    width: CARD_WIDTH,
    padding: 12,
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
    marginTop: 8,
    padding: 16,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 16,
  },
});
