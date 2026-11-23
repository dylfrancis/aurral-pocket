import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useNearbyShows } from "@/hooks/discover";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColors } from "@/hooks/use-colors";
import {
  nearbyCityLabel,
  ticketmasterSetupMessage,
} from "@/lib/discover/nearby-shows";
import type { DiscoverFeedStyle } from "@/lib/types/me";
import type { ConcertEvent } from "@/lib/types/search";
import { NearbyLocationMenu } from "./NearbyLocationMenu";
import { NearbyZipEditorSheet } from "./NearbyZipEditorSheet";
import {
  ShowFeedTile,
  SQUARE_TILE_WIDTH,
  WIDE_TILE_WIDTH,
} from "./ShowFeedTile";
import { ViewAllCard } from "./ViewAllCard";

type Props = {
  /** The style picked for this rail under Customize Discover on the web. */
  feedStyle?: DiscoverFeedStyle;
  onShowPress: (show: ConcertEvent) => void;
  onViewAll: () => void;
};

// The web's rail sizes on a phone.
const LIST_LIMIT = 4;
const TILE_LIMIT = 12;

export function ShowsNearYouSection({
  feedStyle = "list",
  onShowPress,
  onViewAll,
}: Props) {
  const colors = useColors();
  const canManageServer = useHasPermission()("accessSettings");
  const {
    data,
    isLoading,
    errorMessage,
    mode,
    appliedZip,
    appliedCountry,
    setMode,
    setAppliedZip,
    locationLabel,
  } = useNearbyShows();
  const [zipEditorVisible, setZipEditorVisible] = useState(false);

  const handleShowPress = useCallback(
    (show: ConcertEvent) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onShowPress(show);
    },
    [onShowPress],
  );

  const handleZipSave = (zip: string, country: string) => {
    setAppliedZip(zip, country);
    setZipEditorVisible(false);
  };

  const configured = data?.configured !== false;
  const header = (
    <SectionHeader
      title="Shows Near You"
      onNavigate={onViewAll}
      trailing={
        configured ? (
          <NearbyLocationMenu
            cityLabel={nearbyCityLabel(data?.location)}
            mode={mode}
            appliedZip={appliedZip}
            appliedCountry={appliedCountry}
            onSelectYourLocation={() => setMode("ip")}
            onEnterLocation={() => setZipEditorVisible(true)}
            triggerColor={colors.text}
          />
        ) : null
      }
    />
  );

  const status = (title: string, message?: string | null) => (
    <Card bordered style={styles.statusCard}>
      <Text variant="body" style={[styles.statusTitle, { color: colors.text }]}>
        {title}
      </Text>
      {message ? (
        <Text
          variant="caption"
          style={[styles.statusBody, { color: colors.subtle }]}
        >
          {message}
        </Text>
      ) : null}
    </Card>
  );

  const shows = data?.shows ?? [];
  let content;
  if (!configured) {
    content = status(
      "Ticketmaster not configured",
      ticketmasterSetupMessage(canManageServer),
    );
  } else if (isLoading) {
    content = <RailSkeleton feedStyle={feedStyle} />;
  } else if (errorMessage) {
    content = status("Could not load nearby shows.", errorMessage);
  } else if (mode === "zip" && !appliedZip.trim()) {
    content = status(
      "Location not set",
      "Enter a ZIP or postal code, or use your location.",
    );
  } else if (shows.length === 0) {
    content = status(`No matching shows near ${locationLabel}.`);
  } else if (feedStyle === "list") {
    content = (
      <View style={styles.list}>
        {shows.slice(0, LIST_LIMIT).map((show) => (
          <ShowFeedTile
            key={show.id}
            show={show}
            feedStyle="list"
            onPress={handleShowPress}
          />
        ))}
      </View>
    );
  } else {
    const tileWidth =
      feedStyle === "wide" ? WIDE_TILE_WIDTH : SQUARE_TILE_WIDTH;
    content = (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tiles}
      >
        {shows.slice(0, TILE_LIMIT).map((show) => (
          <ShowFeedTile
            key={show.id}
            show={show}
            feedStyle={feedStyle}
            onPress={handleShowPress}
          />
        ))}
        {shows.length > TILE_LIMIT ? (
          <ViewAllCard
            size={feedStyle === "wide" ? (tileWidth * 9) / 16 : tileWidth}
            onPress={onViewAll}
          />
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      {content}
      <NearbyZipEditorSheet
        visible={zipEditorVisible}
        currentZip={appliedZip}
        currentCountry={appliedCountry}
        onSave={handleZipSave}
        onClose={() => setZipEditorVisible(false)}
      />
    </View>
  );
}

function RailSkeleton({ feedStyle }: { feedStyle: DiscoverFeedStyle }) {
  if (feedStyle === "list") {
    return (
      <View style={styles.list} testID="shows-near-you-skeleton">
        {Array.from({ length: LIST_LIMIT }).map((_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={36} height={36} borderRadius={8} />
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={styles.skeletonText}>
              <Skeleton width="100%" height={14} borderRadius={4} />
              <Skeleton width={140} height={12} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  const width = feedStyle === "wide" ? WIDE_TILE_WIDTH : SQUARE_TILE_WIDTH;
  const height = feedStyle === "wide" ? (width * 9) / 16 : width;
  return (
    <View style={styles.tiles} testID="shows-near-you-skeleton">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} width={width} height={height} borderRadius={10} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  list: {
    paddingHorizontal: 16,
  },
  tiles: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  skeletonText: {
    flex: 1,
    gap: 6,
  },
  statusCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    gap: 6,
  },
  statusTitle: {
    ...Fonts.semiBold,
    fontSize: 15,
  },
  statusBody: {
    fontSize: 12,
    lineHeight: 16,
  },
});
