import { useCallback, useMemo, type ReactNode } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/library/EmptyState";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Text } from "@/components/ui/Text";
import { usePreviewRows } from "@/hooks/discover/use-preview-rows";
import {
  isChartNotLoaded,
  useTrendingCharts,
  useTrendingGenreChart,
} from "@/hooks/discover/use-trending";
import { formatChartsMeta } from "@/lib/discover/trending-format";
import type { TrendingChartSong, TrendingSong } from "@/lib/types/search";
import {
  EditorialTrackRow,
  type EditorialTrackItem,
} from "./EditorialTrackRow";
import { SaveChartButton } from "./SaveChartButton";
import { useColors } from "@/hooks/use-colors";

type RouteParams = {
  /** "songs", or a genre's id. */
  chart: string;
  /** Lets the title show before the chart loads. */
  name?: string;
};

type ChartItem = EditorialTrackItem<TrendingSong | TrendingChartSong>;

export function TrendingChartScreen() {
  const { chart, name } = useLocalSearchParams<RouteParams>();
  if (chart === "songs") return <SongsChart />;
  if (/^\d+$/.test(chart ?? ""))
    return <GenreChart genreId={chart} name={name} />;
  return (
    <ScreenCenter>
      <EmptyState icon="alert-circle-outline" message="Unknown chart" />
    </ScreenCenter>
  );
}

function SongsChart() {
  const { data, isPending, isFetching, refetch } = useTrendingCharts();
  const rows = usePreviewRows();
  const songs = data?.songs;

  const items = useMemo<ChartItem[]>(
    () =>
      (songs?.items ?? []).map((song) => ({
        id: `trending-songs-${song.key}`,
        track: song,
      })),
    [songs?.items],
  );

  const isRetrying = !data && isFetching;
  if (isPending || isRetrying) return <ScreenCenter loading />;
  if (!data) return <ChartError onRetry={() => void refetch()} />;
  if (!songs) {
    return (
      <ChartLoading title="Top Songs" onCheckAgain={() => void refetch()} />
    );
  }

  return (
    <ChartList
      title="Top Songs"
      meta={formatChartsMeta(data.region, data.updatedAt)}
      action={<SaveChartButton songs={songs} onLeave={rows.stopPreview} />}
      items={items}
      rows={rows}
    />
  );
}

function GenreChart({ genreId, name }: { genreId: string; name?: string }) {
  const { data, error, isPending, isFetching, refetch } =
    useTrendingGenreChart(genreId);
  const rows = usePreviewRows();
  const title = `Top ${data?.name ?? name ?? "Genre"}`;

  const items = useMemo<ChartItem[]>(
    () =>
      (data?.items ?? []).map((song) => ({
        id: `trending-genre-${genreId}-${song.key}`,
        track: song,
      })),
    [data?.items, genreId],
  );

  const isRetrying = !data && isFetching;
  if (isPending || isRetrying) return <ScreenCenter loading />;
  if (!data) {
    if (isChartNotLoaded(error)) {
      return <ChartLoading title={title} onCheckAgain={() => void refetch()} />;
    }
    return <ChartError title={title} onRetry={() => void refetch()} />;
  }

  return (
    <ChartList
      title={title}
      meta={formatChartsMeta(data.region, data.updatedAt)}
      items={items}
      rows={rows}
    />
  );
}

function ChartList({
  title,
  meta,
  action,
  items,
  rows,
}: {
  title: string;
  meta: string | null;
  action?: ReactNode;
  items: ChartItem[];
  rows: ReturnType<typeof usePreviewRows>;
}) {
  const colors = useColors();
  const {
    playingId,
    loadingId,
    progress,
    lookupRowId,
    togglePreview,
    openRowArtist,
    openRowAlbum,
  } = rows;

  const renderItem = useCallback(
    ({ item }: { item: ChartItem }) => (
      <EditorialTrackRow
        item={item}
        rank={item.track.position}
        movement={"movement" in item.track ? item.track.movement : undefined}
        isPlaying={playingId === item.id}
        isLoading={loadingId === item.id}
        progress={playingId === item.id ? progress : 0}
        isLookingUpLink={lookupRowId === item.id}
        onTogglePreview={togglePreview}
        onOpenArtist={openRowArtist}
        onOpenAlbum={openRowAlbum}
      />
    ),
    [
      playingId,
      loadingId,
      progress,
      lookupRowId,
      togglePreview,
      openRowArtist,
      openRowAlbum,
    ],
  );

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          meta || action ? (
            <View style={styles.header}>
              {meta ? (
                <Text
                  variant="caption"
                  style={[styles.meta, { color: colors.subtle }]}
                >
                  {meta}
                </Text>
              ) : null}
              {action}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <Text variant="caption" style={styles.empty}>
            This chart has no songs
          </Text>
        }
      />
    </>
  );
}

function ChartLoading({
  title,
  onCheckAgain,
}: {
  title: string;
  onCheckAgain: () => void;
}) {
  return (
    <ScreenCenter>
      <Stack.Screen options={{ title }} />
      <EmptyState
        icon="time-outline"
        message="This chart is still loading. Check back soon."
        actionLabel="Check Again"
        onAction={onCheckAgain}
      />
    </ScreenCenter>
  );
}

function ChartError({
  title,
  onRetry,
}: {
  title?: string;
  onRetry: () => void;
}) {
  return (
    <ScreenCenter>
      {title ? <Stack.Screen options={{ title }} /> : null}
      <EmptyState
        icon="cloud-offline-outline"
        message="Couldn't load this chart"
        actionLabel="Try Again"
        onAction={onRetry}
      />
    </ScreenCenter>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  meta: {
    flex: 1,
  },
  empty: {
    textAlign: "center",
    paddingVertical: 32,
  },
});
