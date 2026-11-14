import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { Stack } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SearchBarTextEventData } from "react-native-screens";

import { ScrollHeaderTitle } from "@/components/artist/ArtistDetailLayout";
import { EmptyState } from "@/components/library/EmptyState";
import { Text } from "@/components/ui/Text";
import { PlaylistTrackRow } from "./PlaylistTrackRow";
import type {
  TrackMenuAction,
  TrackMenuActionId,
} from "@/components/player/track-menu-types";
import { searchBarColors } from "@/constants/navigation";
import { IS_IOS } from "@/constants/platform";
import { isPlayableJob } from "@/lib/player/track-item";
import type { FlowJob, PlaylistStats } from "@/lib/types/flow";
import { useColors } from "@/hooks/use-colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
export const COVER_SIZE = Math.min(SCREEN_WIDTH - 120, 260);

type TrackRowItem = { job: FlowJob; position: number };

export function summaryLine(total: number, stats?: PlaylistStats) {
  if (total <= 0) return "";
  const tracks = `${total} track${total === 1 ? "" : "s"}`;
  if (!stats) return tracks;
  const done = Math.max(0, Math.min(stats.done, total));
  return done < total ? `${tracks} · ${done} ready` : tracks;
}

type Props = {
  title: string;
  jobs: FlowJob[];
  jobsLoading: boolean;
  searchPlaceholder: string;
  /**
   * Memoize this with stable handlers: a rebuilt header can drop the Android
   * search icon, and this page re-renders on every keystroke and status poll.
   */
  toolbar: ReactNode;
  header: ReactNode;
  emptyMessage: string;
  onPlayTrack: (jobId: string) => void;
  /** An empty list leaves the row without a menu. */
  trackMenuActions?: (job: FlowJob) => TrackMenuAction[];
  onTrackMenuAction?: (job: FlowJob, id: TrackMenuActionId) => void;
  /** Opens the track's sheet in place of the native menu. */
  onTrackMenuPress?: (job: FlowJob) => void;
  /** Rows show ↓ for tracks on the phone. */
  markSavedTracks?: boolean;
};

const NO_ACTIONS: TrackMenuAction[] = [];
const noMenuActions = () => NO_ACTIONS;
const ignoreMenuAction = () => {};

export function CollectionPage({
  title,
  jobs,
  jobsLoading,
  searchPlaceholder,
  toolbar,
  header,
  emptyMessage,
  onPlayTrack,
  trackMenuActions = noMenuActions,
  onTrackMenuAction = ignoreMenuAction,
  onTrackMenuPress,
  markSavedTracks = false,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // See AlbumDetailScreen: only iOS scrolls under its translucent header.
  const headerHeight = useHeaderHeight();
  const headerPaddingTop = (IS_IOS ? headerHeight : 0) + 24;

  // Only narrows the rows. Tracks keep their numbers, and playing a result
  // still queues everything.
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const rows = useMemo<TrackRowItem[]>(() => {
    const query = trimmedQuery.toLocaleLowerCase();
    return jobs
      .map((job, index) => ({ job, position: index + 1 }))
      .filter(({ job }) =>
        [job.trackName, job.artistName, job.albumName].some((field) =>
          field?.toLocaleLowerCase().includes(query),
        ),
      );
  }, [jobs, trimmedQuery]);
  // Stable, so typing can't rebuild the native header. See ReleaseGrid.
  const handleSearchChange = useCallback(
    (event: NativeSyntheticEvent<SearchBarTextEventData>) =>
      setSearchQuery(event.nativeEvent.text),
    [],
  );
  const handleSearchCancel = useCallback(() => setSearchQuery(""), []);

  const renderItem = useCallback(
    ({ item: { job, position } }: { item: TrackRowItem }) => (
      <PlaylistTrackRow
        job={job}
        position={position}
        onPress={isPlayableJob(job) ? () => onPlayTrack(job.id) : undefined}
        menuActions={onTrackMenuPress ? NO_ACTIONS : trackMenuActions(job)}
        onMenuAction={onTrackMenuAction}
        onMenuPress={onTrackMenuPress}
        markSaved={markSavedTracks}
      />
    ),
    [
      onPlayTrack,
      trackMenuActions,
      onTrackMenuAction,
      onTrackMenuPress,
      markSavedTracks,
    ],
  );

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollHeaderTitle name={title} scrollY={scrollY} />
      <Stack.SearchBar
        placeholder={searchPlaceholder}
        hideWhenScrolling={false}
        autoCapitalize="none"
        {...searchBarColors(colors)}
        onChangeText={handleSearchChange}
        onCancelButtonPress={handleSearchCancel}
      />
      {toolbar}

      <Animated.FlatList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(row: TrackRowItem) => row.job.id}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListHeaderComponent={
          <View style={{ paddingTop: headerPaddingTop }}>
            {/* The cover and the keyboard would fill the screen and hide the
                results. Hidden, not unmounted, so the cover doesn't reload. */}
            <View style={trimmedQuery ? styles.hidden : undefined}>
              {header}
            </View>
          </View>
        }
        ListEmptyComponent={
          jobsLoading ? (
            <ActivityIndicator style={styles.loader} color={colors.brand} />
          ) : trimmedQuery ? (
            <EmptyState
              icon="search-outline"
              message={`No results matching “${trimmedQuery}”`}
            />
          ) : (
            <Text variant="caption" style={styles.emptyText}>
              {emptyMessage}
            </Text>
          )
        }
      />
    </View>
  );
}

export function CollectionHero({
  artwork,
  name,
  children,
}: {
  artwork: ReactNode;
  name: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.hero}>
      {artwork}
      <Text variant="title" style={styles.name}>
        {name}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    display: "none",
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  name: {
    textAlign: "center",
    marginTop: 8,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
});
