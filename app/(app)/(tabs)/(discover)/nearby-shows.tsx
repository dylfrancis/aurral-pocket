import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/library/EmptyState";
import { SearchBar } from "@/components/library/SearchBar";
import { NearbyShowRow } from "@/components/discover/NearbyShowRow";
import { NearbyZipEditorSheet } from "@/components/discover/NearbyZipEditorSheet";
import {
  NearbyShowsFilterSheet,
  type NearbyShowsDateRange,
  type NearbyShowsSort,
} from "@/components/discover/NearbyShowsFilterSheet";
import { useNearbyLocationPref, useNearbyShows } from "@/hooks/discover";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import type { ConcertEvent } from "@/lib/types/search";

const PAGE_LIMIT = 60;

type SourceFilter = "all" | "library" | "recommended";
const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "library", label: "Library" },
  { value: "recommended", label: "Recommended" },
];

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function getWeekendRange(now: Date) {
  const day = now.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() + daysUntilSaturday);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start: startOfDay(start), end: endOfDay(end) };
}

function getNext30Range(now: Date) {
  const start = startOfDay(now);
  const end = new Date(now);
  end.setDate(now.getDate() + 30);
  return { start, end: endOfDay(end) };
}

function parseShowDate(show: ConcertEvent): Date | null {
  const raw = show.dateTime || show.date || "";
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function withinDateRange(
  show: ConcertEvent,
  range: NearbyShowsDateRange,
): boolean {
  if (range === "all") return true;
  const date = parseShowDate(show);
  if (!date) return false;
  const now = new Date();
  const { start, end } =
    range === "weekend" ? getWeekendRange(now) : getNext30Range(now);
  return date >= start && date <= end;
}

function matchesSource(show: ConcertEvent, source: SourceFilter): boolean {
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
  const navigation = useNavigation();
  const {
    mode,
    appliedZip,
    radiusMiles,
    setMode,
    setAppliedZip,
    setRadiusMiles,
  } = useNearbyLocationPref();

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sort, setSort] = useState<NearbyShowsSort>("date");
  const [dateRange, setDateRange] = useState<NearbyShowsDateRange>("all");
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [zipEditorVisible, setZipEditorVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const zipModeActive = mode === "zip";
  const zipQueryValue =
    zipModeActive && appliedZip.trim() ? appliedZip.trim() : undefined;
  const queryEnabled = !zipModeActive || !!appliedZip.trim();

  const { data, isLoading, refetch } = useNearbyShows({
    zipCode: zipQueryValue,
    limit: PAGE_LIMIT,
    radiusMiles,
    enabled: queryEnabled,
  });

  const openFilters = useCallback(() => {
    void Haptics.selectionAsync();
    setFilterSheetVisible(true);
  }, []);

  const closeFilters = useCallback(() => setFilterSheetVisible(false), []);

  const openZipEditor = useCallback(() => {
    void Haptics.selectionAsync();
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

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openFilters}
          accessibilityLabel="Filters"
          style={({ pressed }) => [
            styles.headerButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="options-outline" size={22} color={colors.text} />
        </Pressable>
      ),
      ...(IS_IOS
        ? {
            headerSearchBarOptions: {
              placeholder: "Search artists or events",
              hideWhenScrolling: false,
              autoCapitalize: "none" as const,
              onChangeText: (e: { nativeEvent: { text: string } }) => {
                setSearchQuery(e.nativeEvent.text);
              },
              onCancelButtonPress: () => setSearchQuery(""),
            },
          }
        : {}),
    });
  }, [navigation, openFilters, colors.text]);

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
      {!IS_IOS && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          sortMode="alpha"
          onSortChange={() => {}}
          showSort={false}
          placeholder="Search artists or events"
        />
      )}
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
      {data?.configured !== false && (
        <View style={styles.sourceChipRow}>
          {SOURCE_OPTIONS.map((option) => {
            const active = sourceFilter === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSourceFilter(option.value);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? `${colors.brand}20` : colors.card,
                    borderColor: active ? colors.brand : colors.separator,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={[
                    styles.chipLabel,
                    {
                      color: active ? colors.brand : colors.subtle,
                      fontFamily: active ? Fonts.semiBold : Fonts.medium,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
      <NearbyShowsFilterSheet
        visible={filterSheetVisible}
        sort={sort}
        dateRange={dateRange}
        radiusMiles={radiusMiles}
        onChangeSort={setSort}
        onChangeDateRange={setDateRange}
        onChangeRadius={setRadiusMiles}
        onClose={closeFilters}
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
  sourceChipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
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
  headerButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
