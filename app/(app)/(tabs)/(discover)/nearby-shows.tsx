import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Linking,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { NearbyLocationMenu } from "@/components/discover/NearbyLocationMenu";
import { NearbyZipEditorSheet } from "@/components/discover/NearbyZipEditorSheet";
import {
  DATE_RANGE_OPTIONS,
  SOURCE_OPTIONS,
  type NearbyShowsDateRange,
  type NearbyShowsSource,
} from "@/components/discover/NearbyShowsFilterSheet";
import { ShowFeedTile } from "@/components/discover/ShowFeedTile";
import { ShowLead } from "@/components/discover/ShowLead";
import { useNearbyShows } from "@/hooks/discover";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { searchBarColors } from "@/constants/navigation";
import { Fonts } from "@/constants/theme";
import {
  filterNearbyShows,
  getEventUrl,
  nearbyCityLabel,
  SHOWS_PAGE_LIMIT,
  splitShowFeed,
  ticketmasterSetupMessage,
} from "@/lib/discover/nearby-shows";
import type { ConcertEvent } from "@/lib/types/search";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import {
  FILTER_MENU_ICON,
  menuOptionSection,
} from "@/components/ui/MenuOptions";
import { useColors } from "@/hooks/use-colors";

type MonthSection = { title: string; data: ConcertEvent[] };

export default function NearbyShowsScreen() {
  const colors = useColors();
  const canManageServer = useHasPermission()("accessSettings");
  const {
    data,
    isLoading,
    errorMessage,
    refetch,
    mode,
    appliedZip,
    appliedCountry,
    setMode,
    setAppliedZip,
    locationLabel,
  } = useNearbyShows();

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<NearbyShowsSource>("all");
  const [dateRange, setDateRange] = useState<NearbyShowsDateRange>("all");
  const [zipEditorVisible, setZipEditorVisible] = useState(false);

  const openZipEditor = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setZipEditorVisible(true);
  };

  const handleZipSave = (zip: string, country: string) => {
    setAppliedZip(zip, country);
    setZipEditorVisible(false);
  };

  const handleSelectYourLocation = useCallback(() => {
    void Haptics.selectionAsync();
    setMode("ip");
  }, [setMode]);

  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  const handleShowPress = useCallback((show: ConcertEvent) => {
    const url = getEventUrl(show.url);
    if (!url) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(url).catch(() => {});
  }, []);

  const allShows = useMemo(() => data?.shows ?? [], [data?.shows]);
  const { lead, shelf, groups } = useMemo(
    () =>
      splitShowFeed(
        filterNearbyShows(allShows, {
          source: sourceFilter,
          dateRange,
          query: searchQuery,
        }).slice(0, SHOWS_PAGE_LIMIT),
      ),
    [allShows, sourceFilter, dateRange, searchQuery],
  );
  const sections = useMemo<MonthSection[]>(
    () => groups.map((group) => ({ title: group.label, data: group.shows })),
    [groups],
  );

  const configured = data?.configured !== false;

  const emptyMessage = searchQuery.trim()
    ? `No shows match “${searchQuery.trim()}”.`
    : sourceFilter === "library"
      ? `No shows for Library artists near ${locationLabel}.`
      : sourceFilter === "discover"
        ? `No shows for recommended artists near ${locationLabel}.`
        : `No shows for Library or recommended artists near ${locationLabel}.`;

  let body: ReactNode;
  if (!configured) {
    body = (
      <StatePanel
        icon="location-outline"
        title="Ticketmaster not configured"
        message={ticketmasterSetupMessage(canManageServer)}
      />
    );
  } else if (isLoading) {
    body = <FeedSkeleton />;
  } else if (errorMessage) {
    body = (
      <StatePanel
        icon="alert-circle-outline"
        title="Couldn’t load nearby shows"
        message={errorMessage}
      />
    );
  } else if (mode === "zip" && !appliedZip.trim()) {
    body = (
      <StatePanel
        icon="location-outline"
        title="Enter a ZIP or postal code"
        message="Pick a place to see the shows near it."
        actionLabel="Enter a Location"
        onAction={openZipEditor}
      />
    );
  } else if (lead) {
    body = (
      <>
        <View style={styles.gutter}>
          <ShowLead show={lead} onPress={handleShowPress} />
        </View>
        {shelf.length > 0 ? (
          <View style={styles.shelf}>
            <SectionHeader title="Coming Up" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelfTiles}
            >
              {shelf.map((show) => (
                <ShowFeedTile
                  key={show.id}
                  show={show}
                  feedStyle="square"
                  onPress={handleShowPress}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </>
    );
  } else {
    body = (
      <StatePanel
        icon="musical-notes-outline"
        title={
          allShows.length > 0
            ? "No matches in this filter"
            : "No upcoming nearby matches"
        }
        message={emptyMessage}
      />
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      {configured ? (
        <View style={styles.gutter}>
          <View style={styles.locationRow}>
            <NearbyLocationMenu
              cityLabel={nearbyCityLabel(data?.location)}
              mode={mode}
              appliedZip={appliedZip}
              appliedCountry={appliedCountry}
              onSelectYourLocation={handleSelectYourLocation}
              onEnterLocation={openZipEditor}
              triggerColor={colors.text}
            />
          </View>
        </View>
      ) : null}
      {body}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: "Shows Near You" }} />
      <Stack.SearchBar
        placeholder="Search artists or events"
        hideWhenScrolling={false}
        autoCapitalize="none"
        {...searchBarColors(colors)}
        onChangeText={(e) => setSearchQuery(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearchQuery("")}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon={FILTER_MENU_ICON} title="Filters">
          {menuOptionSection(
            "Date range",
            DATE_RANGE_OPTIONS,
            dateRange,
            setDateRange,
          )}
          {menuOptionSection(
            "Show",
            SOURCE_OPTIONS,
            sourceFilter,
            setSourceFilter,
          )}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <SectionList
        sections={lead ? sections : []}
        keyExtractor={(show) => show.id}
        renderItem={({ item }) => (
          <View style={styles.gutter}>
            <ShowFeedTile
              show={item}
              feedStyle="list"
              onPress={handleShowPress}
            />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.monthHeader}>
            <SectionHeader title={section.title} />
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={listHeader}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.listContent,
          { backgroundColor: colors.background },
        ]}
        style={{ backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.subtle}
          />
        }
      />
      <NearbyZipEditorSheet
        visible={zipEditorVisible}
        currentZip={appliedZip}
        currentCountry={appliedCountry}
        onSave={handleZipSave}
        onClose={() => setZipEditorVisible(false)}
      />
    </>
  );
}

function StatePanel({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.statePanel}>
      <Ionicons name={icon} size={40} color={colors.subtle} />
      <Text
        variant="body"
        style={[styles.stateTitle, { color: colors.text }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <Text variant="caption" style={styles.stateMessage}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          style={styles.stateAction}
        />
      ) : null}
    </View>
  );
}

function FeedSkeleton() {
  const { width } = useWindowDimensions();
  const artWidth = width - 32;
  return (
    <View style={[styles.gutter, styles.skeleton]} testID="shows-skeleton">
      <Skeleton width="100%" height={(artWidth * 9) / 16} borderRadius={12} />
      <Skeleton width={260} height={22} borderRadius={6} />
      <Skeleton width={200} height={14} borderRadius={4} />
      <Skeleton width={180} height={14} borderRadius={4} />
      {Array.from({ length: 4 }).map((_, i) => (
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

const styles = StyleSheet.create({
  listContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  listHeader: {
    gap: 20,
  },
  gutter: {
    paddingHorizontal: 16,
  },
  locationRow: {
    flexDirection: "row",
  },
  shelf: {
    marginBottom: 4,
  },
  shelfTiles: {
    paddingHorizontal: 16,
    gap: 12,
  },
  monthHeader: {
    paddingTop: 20,
  },
  statePanel: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 8,
  },
  stateTitle: {
    ...Fonts.semiBold,
    fontSize: 17,
    textAlign: "center",
  },
  stateMessage: {
    textAlign: "center",
  },
  stateAction: {
    width: "auto",
    height: 44,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  skeleton: {
    gap: 10,
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
});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <RouteErrorBoundary {...props} message="Failed to load nearby shows" />
  );
}
