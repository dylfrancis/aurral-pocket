import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import type { NearbyLocationMode } from "@/hooks/discover";
import { useNearbyShows } from "@/hooks/discover";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ConcertEvent } from "@/lib/types/search";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

type Props = {
  onShowPress: (show: ConcertEvent) => void;
  onOpenSettings: () => void;
  mode: NearbyLocationMode;
  appliedZip: string;
  onModeChange: (mode: NearbyLocationMode) => void;
  onEditZip: () => void;
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
    .join(" - ");
}

export function ShowsNearYouSection({
  onShowPress,
  onOpenSettings,
  mode,
  appliedZip,
  onModeChange,
  onEditZip,
}: Props) {
  const colors = Colors[useColorScheme()];

  const zipModeActive = mode === "zip";
  const zipQueryValue =
    zipModeActive && appliedZip.trim() ? appliedZip.trim() : undefined;

  const { data, isLoading } = useNearbyShows({
    zipCode: zipQueryValue,
    enabled: !zipModeActive || !!appliedZip.trim(),
  });

  const handleSelectIp = useCallback(() => {
    void Haptics.selectionAsync();
    onModeChange("ip");
  }, [onModeChange]);

  const handleSelectZip = useCallback(() => {
    void Haptics.selectionAsync();
    onModeChange("zip");
  }, [onModeChange]);

  const handleEditZip = useCallback(() => {
    void Haptics.selectionAsync();
    onEditZip();
  }, [onEditZip]);

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

  const locationLabel =
    data?.location?.label || data?.location?.postalCode || "your area";

  const header = (
    <SectionHeader
      title="Shows Near You"
      trailing={
        <ModeToggle
          mode={mode}
          onSelectIp={handleSelectIp}
          onSelectZip={handleSelectZip}
          onEditZip={handleEditZip}
        />
      }
    />
  );

  const locationPill = data?.configured !== false && (
    <View style={styles.locationRow}>
      <Text
        variant="caption"
        style={[styles.locationPill, { color: colors.subtle }]}
      >
        {locationLabel}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {header}
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
        {header}
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
          <Button title="Open Settings" onPress={handleOpenSettings} />
        </View>
      </View>
    );
  }

  if (zipModeActive && !appliedZip.trim()) {
    return (
      <View style={styles.container}>
        {header}
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
            ZIP not set
          </Text>
          <Text
            variant="caption"
            style={[styles.emptyBody, { color: colors.subtle }]}
          >
            Enter a ZIP code to search for shows in that area.
          </Text>
          <Button title="Set ZIP" onPress={handleEditZip} />
        </View>
      </View>
    );
  }

  const shows = data?.shows ?? [];

  if (shows.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        {locationPill}
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
            No upcoming nearby matches
          </Text>
          <Text
            variant="caption"
            style={[styles.emptyBody, { color: colors.subtle }]}
          >
            We could not find local Ticketmaster shows for artists from your
            library around {locationLabel}.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      {locationPill}
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
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type ModeToggleProps = {
  mode: NearbyLocationMode;
  onSelectIp: () => void;
  onSelectZip: () => void;
  onEditZip: () => void;
};

function ModeToggle({
  mode,
  onSelectIp,
  onSelectZip,
  onEditZip,
}: ModeToggleProps) {
  const colors = Colors[useColorScheme()];
  const zipActive = mode === "zip";

  return (
    <View style={styles.toggleRow}>
      <View
        style={[
          styles.segmented,
          { backgroundColor: colors.card, borderColor: colors.separator },
        ]}
      >
        <Pressable
          onPress={onSelectIp}
          style={({ pressed }) => [
            styles.segment,
            !zipActive && { backgroundColor: colors.brand },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text
            variant="caption"
            style={[
              styles.segmentLabel,
              {
                color: !zipActive ? colors.background : colors.subtle,
                fontFamily: Fonts.semiBold,
              },
            ]}
          >
            Your Area
          </Text>
        </Pressable>
        <Pressable
          onPress={onSelectZip}
          style={({ pressed }) => [
            styles.segment,
            zipActive && { backgroundColor: colors.brand },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text
            variant="caption"
            style={[
              styles.segmentLabel,
              {
                color: zipActive ? colors.background : colors.subtle,
                fontFamily: Fonts.semiBold,
              },
            ]}
          >
            ZIP
          </Text>
        </Pressable>
      </View>
      {zipActive && (
        <Pressable
          onPress={onEditZip}
          style={({ pressed }) => [
            styles.editButton,
            { backgroundColor: colors.card, borderColor: colors.separator },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel="Edit ZIP"
        >
          <Ionicons name="pencil" size={14} color={colors.subtle} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  segmentLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  locationRow: {
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 8,
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
    marginTop: 8,
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
    marginTop: 8,
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
});
