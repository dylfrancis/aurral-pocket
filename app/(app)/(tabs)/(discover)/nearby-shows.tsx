import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import * as Haptics from "expo-haptics";
import FilterList from "@expo/material-symbols/filter_list.xml";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/library/EmptyState";
import { NearbyShowRow } from "@/components/discover/NearbyShowRow";
import { NearbyZipEditorSheet } from "@/components/discover/NearbyZipEditorSheet";
import {
  DATE_RANGE_OPTIONS,
  SORT_OPTIONS,
  SOURCE_OPTIONS,
  type NearbyShowsDateRange,
  type NearbyShowsSort,
  type NearbyShowsSource,
} from "@/components/discover/NearbyShowsFilterSheet";
import { useNearbyLocationPref, useNearbyShows } from "@/hooks/discover";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import {
  isInNext30Days,
  isInThisWeekend,
  parseShowDate,
} from "@/lib/discover/show-dates";
import type { ConcertEvent } from "@/lib/types/search";

const PAGE_LIMIT = 60;

function withinDateRange(
  show: ConcertEvent,
  range: NearbyShowsDateRange,
): boolean {
  if (range === "all") return true;
  const date = parseShowDate(show);
  if (!date) return false;
  return range === "weekend" ? isInThisWeekend(date) : isInNext30Days(date);
}

function matchesSource(show: ConcertEvent, source: NearbyShowsSource): boolean {
  if (source === "all") return true;
  return show.matchType === source;
}

function matchesQuery(show: ConcertEvent, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    show.artistName.toLowerCase().includes(q) ||
    (show.eventName ? show.eventName.toLowerCase().includes(q) : false)
  );
}

function compareShows(a: ConcertEvent, b: ConcertEvent, sort: NearbyShowsSort) {
  switch (sort) {
    case "distance": {
      const aDist = Number.isFinite(a.distance)
        ? (a.distance as number)
        : Number.POSITIVE_INFINITY;
      const bDist = Number.isFinite(b.distance)
        ? (b.distance as number)
        : Number.POSITIVE_INFINITY;
      if (aDist !== bDist) return aDist - bDist;
      return (a.dateTime || a.date || "").localeCompare(
        b.dateTime || b.date || "",
      );
    }
    case "artist":
      return a.artistName.localeCompare(b.artistName, undefined, {
        sensitivity: "base",
      });
    case "date":
    default: {
      const aTime = a.dateTime || a.date || "";
      const bTime = b.dateTime || b.date || "";
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      const aDist = Number.isFinite(a.distance)
        ? (a.distance as number)
        : Number.POSITIVE_INFINITY;
      const bDist = Number.isFinite(b.distance)
        ? (b.distance as number)
        : Number.POSITIVE_INFINITY;
      return aDist - bDist;
    }
  }
}

export default function NearbyShowsScreen() {
  const colors = Colors[useColorScheme()];
  const { mode, appliedZip, setMode, setAppliedZip } = useNearbyLocationPref();

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<NearbyShowsSource>("all");
  const [sort, setSort] = useState<NearbyShowsSort>("date");
  const [dateRange, setDateRange] = useState<NearbyShowsDateRange>("all");
  const [zipEditorVisible, setZipEditorVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const zipModeActive = mode === "zip";
  const zipQueryValue =
    zipModeActive && appliedZip.trim() ? appliedZip.trim() : undefined;
  const queryEnabled = !zipModeActive || !!appliedZip.trim();

  const { data, isLoading, refetch } = useNearbyShows({
    zipCode: zipQueryValue,
    limit: PAGE_LIMIT,
    enabled: queryEnabled,
  });

  const openZipEditor = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setZipEditorVisible(true);
  }, []);

  const closeZipEditor = useCallback(() => setZipEditorVisible(false), []);

  const handleZipSave = useCallback(
    (zip: string) => {
      setAppliedZip(zip);
      setMode("zip");
      setZipEditorVisible(false);
    },
    [setAppliedZip, setMode],
  );

  const handleSelectIp = useCallback(() => {
    void Haptics.selectionAsync();
    setMode("ip");
  }, [setMode]);

  const handleSelectZip = useCallback(() => {
    void Haptics.selectionAsync();
    setMode("zip");
  }, [setMode]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleShowPress = useCallback((show: ConcertEvent) => {
    if (show.url) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Linking.openURL(show.url).catch(() => {});
    }
  }, []);

  const shows = useMemo(() => data?.shows ?? [], [data?.shows]);

  const visibleShows = useMemo(() => {
    return shows
      .filter((s) => matchesSource(s, sourceFilter))
      .filter((s) => withinDateRange(s, dateRange))
      .filter((s) => matchesQuery(s, searchQuery))
      .slice()
      .sort((a, b) => compareShows(a, b, sort));
  }, [shows, sourceFilter, dateRange, searchQuery, sort]);

  const locationLabel =
    data?.location?.label || data?.location?.postalCode || "";

  const renderItem = useCallback(
    ({ item }: { item: ConcertEvent }) => (
      <View style={styles.rowWrapper}>
        <NearbyShowRow show={item} onPress={() => handleShowPress(item)} />
      </View>
    ),
    [handleShowPress],
  );

  const keyExtractor = useCallback(
    (item: ConcertEvent) => `${item.id}-${item.artistName}`,
    [],
  );

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      {data?.configured !== false && (
        <View style={styles.locationRow}>
          <Text
            variant="body"
            style={[styles.locationText, { color: colors.subtle }]}
            numberOfLines={1}
          >
            {locationLabel ||
              (zipModeActive ? "Set a ZIP code" : "Finding your area…")}
          </Text>
          <SegmentedControl
            values={["Your Area", "ZIP"]}
            selectedIndex={zipModeActive ? 1 : 0}
            onChange={(event) => {
              const index = event.nativeEvent.selectedSegmentIndex;
              if (index === 0) handleSelectIp();
              else handleSelectZip();
            }}
            fontStyle={{
              fontFamily: Fonts.medium,
              fontSize: 12,
              color: colors.text,
            }}
            activeFontStyle={{
              fontFamily: Fonts.semiBold,
              fontSize: 12,
              color: colors.background,
            }}
            tintColor={colors.brand}
            backgroundColor={colors.background}
            style={styles.segmentedControl}
          />
        </View>
      )}
      {zipModeActive && (
        <Pressable
          onPress={openZipEditor}
          style={({ pressed }) => [
            styles.zipEditRow,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="pencil" size={12} color={colors.subtle} />
          <Text
            variant="caption"
            style={[styles.zipEditText, { color: colors.subtle }]}
          >
            {appliedZip.trim()
              ? `Edit ZIP (${appliedZip.trim()})`
              : "Enter ZIP code"}
          </Text>
        </Pressable>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.skeletons}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={92} borderRadius={12} />
          ))}
        </View>
      );
    }

    if (data?.configured === false) {
      return (
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
        </View>
      );
    }

    if (zipModeActive && !appliedZip.trim()) {
      return (
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
          <Button title="Set ZIP" onPress={openZipEditor} />
        </View>
      );
    }

    if (shows.length === 0) {
      return (
        <EmptyState
          icon="musical-notes-outline"
          message="No nearby shows found for your library and recommendations."
        />
      );
    }

    return (
      <EmptyState
        icon="search-outline"
        message="No shows match your filters."
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Shows Near You" }} />
      <Stack.SearchBar
        placeholder="Search artists or events"
        hideWhenScrolling={false}
        autoCapitalize="none"
        onChangeText={(e) => setSearchQuery(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearchQuery("")}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            process.env.EXPO_OS === "ios"
              ? "line.3.horizontal.decrease"
              : FilterList
          }
          title="Filters"
        >
          <Stack.Toolbar.Menu inline title="Sort by">
            {SORT_OPTIONS.map((option) => (
              <Stack.Toolbar.MenuAction
                key={option.value}
                isOn={sort === option.value}
                onPress={() => setSort(option.value)}
              >
                {option.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu inline title="Date range">
            {DATE_RANGE_OPTIONS.map((option) => (
              <Stack.Toolbar.MenuAction
                key={option.value}
                isOn={dateRange === option.value}
                onPress={() => setDateRange(option.value)}
              >
                {option.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu inline title="Show">
            {SOURCE_OPTIONS.map((option) => (
              <Stack.Toolbar.MenuAction
                key={option.value}
                isOn={sourceFilter === option.value}
                onPress={() => setSourceFilter(option.value)}
              >
                {option.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlatList
        data={visibleShows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.listContent,
          { backgroundColor: colors.background },
        ]}
        style={{ backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.subtle}
          />
        }
      />
      <NearbyZipEditorSheet
        visible={zipEditorVisible}
        currentZip={appliedZip}
        onSave={handleZipSave}
        onClose={closeZipEditor}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  listHeader: {
    gap: 12,
    paddingBottom: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 15,
  },
  segmentedControl: {
    width: 160,
  },
  zipEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  zipEditText: {
    fontSize: 12,
  },
  rowWrapper: {
    paddingBottom: 10,
  },
  skeletons: {
    gap: 10,
  },
  emptyCard: {
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
