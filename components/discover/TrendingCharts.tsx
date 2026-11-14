import { memo, useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { EmptyState } from "@/components/library/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import {
  usePreviewPlayback,
  useRowLinks,
} from "@/hooks/discover/use-preview-rows";
import { useTrendingCharts } from "@/hooks/discover/use-trending";
import { stopPreviewClip } from "@/hooks/library/use-audio-preview";
import { formatChartsMeta } from "@/lib/discover/trending-format";
import type {
  TrendingAlbum,
  TrendingArtist,
  TrendingChartSong,
  TrendingGenre,
  TrendingSongsChart,
} from "@/lib/types/search";
import { ChartPlaceholder } from "./ChartPlaceholder";
import {
  EditorialTrackRow,
  type EditorialTrackItem,
} from "./EditorialTrackRow";
import { SaveChartButton } from "./SaveChartButton";
import { TrendingAlbumRail } from "./TrendingAlbumRail";
import { TrendingArtistRail } from "./TrendingArtistRail";
import { TrendingGenreRail } from "./TrendingGenreRail";
import { TrendingGenreShare } from "./TrendingGenreShare";
import { TrendingSpotlightCard } from "./TrendingSpotlight";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { useColors } from "@/hooks/use-colors";

const LAST_LISTED_RANK = 10;

const songRowId = (song: TrendingChartSong) => `trending-song-${song.key}`;

const albumRowId = (album: TrendingAlbum) => `trending-album-${album.key}`;

/**
 * Stays mounted while another Discover tab shows, so `active` says whether it's
 * in sight.
 */
export function TrendingCharts({ active = true }: { active?: boolean }) {
  const colors = useColors();
  const router = useRouter();
  const openArtistPage = useOpenArtist();
  const { data, isPending, isFetching, refetch } = useTrendingCharts();
  useEffect(() => {
    if (!active) stopPreviewClip();
  }, [active]);
  useEffect(() => () => stopPreviewClip(), []);
  // TopSongs subscribes to the player itself, so a playback tick doesn't
  // re-render every rail.
  const links = useRowLinks(stopPreviewClip, active);
  const { openAlbum } = links;

  const openFullChart = useCallback(() => {
    stopPreviewClip();
    router.push({
      pathname: "/(app)/(tabs)/(discover)/trending/[chart]",
      params: { chart: "songs" },
    });
  }, [router]);

  const openGenre = useCallback(
    (genre: TrendingGenre) => {
      stopPreviewClip();
      router.push({
        pathname: "/(app)/(tabs)/(discover)/trending/[chart]",
        params: { chart: String(genre.id), name: genre.name },
      });
    },
    [router],
  );

  const openArtist = useCallback(
    (artist: TrendingArtist & { mbid: string }) => {
      stopPreviewClip();
      openArtistPage({ mbid: artist.mbid, name: artist.name });
    },
    [openArtistPage],
  );

  const openChartAlbum = useCallback(
    (album: TrendingAlbum) =>
      void openAlbum(albumRowId(album), {
        artistName: album.artistName,
        albumName: album.name,
        deezerAlbumId: null,
      }),
    [openAlbum],
  );

  const isRetrying = !data && isFetching;
  if (isPending || isRetrying) {
    return (
      <View style={styles.loading}>
        <AlbumCategorySkeleton />
        <AlbumCategorySkeleton />
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.error}>
        <EmptyState
          icon="cloud-offline-outline"
          message="Charts didn't load"
          actionLabel="Try Again"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  const meta = formatChartsMeta(data.region, data.updatedAt);
  const albumBeingLookedUp = data.albums?.find(
    (album) => albumRowId(album) === links.lookupRowId,
  );

  return (
    <View>
      {meta ? (
        <Text variant="caption" style={[styles.meta, { color: colors.subtle }]}>
          {meta}
        </Text>
      ) : null}
      {data.songs ? (
        <TopSongs songs={data.songs} links={links} onShowAll={openFullChart} />
      ) : (
        <ChartPlaceholder title="Top Songs" />
      )}
      {data.albums ? (
        <TrendingAlbumRail
          albums={data.albums}
          lookingUpKey={albumBeingLookedUp?.key ?? null}
          onOpenAlbum={openChartAlbum}
        />
      ) : (
        <ChartPlaceholder title="Top Albums" />
      )}
      {data.artists ? (
        <TrendingArtistRail artists={data.artists} onOpenArtist={openArtist} />
      ) : (
        <ChartPlaceholder title="Top Artists" />
      )}
      {data.genres.length > 0 ? (
        <TrendingGenreRail genres={data.genres} onOpenGenre={openGenre} />
      ) : (
        <ChartPlaceholder title="Charts by Genre" />
      )}
      {data.genreShare && data.genreShare.genres.length > 0 ? (
        <TrendingGenreShare share={data.genreShare} />
      ) : null}
    </View>
  );
}

const TopSongs = memo(function TopSongs({
  songs,
  links,
  onShowAll,
}: {
  songs: TrendingSongsChart;
  links: ReturnType<typeof useRowLinks>;
  onShowAll: () => void;
}) {
  const colors = useColors();
  const { playingId, loadingId, progress, togglePreview } =
    usePreviewPlayback();
  const { lookupRowId, openRowArtist, openRowAlbum } = links;

  // Kept between player ticks, so EditorialTrackRow's memo holds.
  const items = useMemo(
    () =>
      songs.items.map<EditorialTrackItem<TrendingChartSong>>((song) => ({
        id: songRowId(song),
        track: song,
      })),
    [songs.items],
  );
  const lead = items[0];
  if (!lead) return <ChartPlaceholder title="Top Songs" />;

  return (
    <>
      <TrendingSpotlightCard
        song={lead.track}
        spotlight={songs.spotlight}
        isPlaying={playingId === lead.id}
        isLoading={loadingId === lead.id}
        isLookingUpLink={lookupRowId === lead.id}
        onTogglePreview={() => togglePreview(lead)}
        onOpenArtist={() => openRowArtist(lead)}
        onOpenAlbum={() => openRowAlbum(lead)}
      />
      <View style={styles.section}>
        <SectionHeader
          title="Top Songs"
          onNavigate={onShowAll}
          trailing={<SaveChartButton songs={songs} onLeave={stopPreviewClip} />}
        />
        {items.slice(1, LAST_LISTED_RANK).map((item) => (
          <EditorialTrackRow
            key={item.id}
            item={item}
            rank={item.track.position}
            movement={item.track.movement}
            isPlaying={playingId === item.id}
            isLoading={loadingId === item.id}
            progress={playingId === item.id ? progress : 0}
            isLookingUpLink={lookupRowId === item.id}
            onTogglePreview={togglePreview}
            onOpenArtist={openRowArtist}
            onOpenAlbum={openRowAlbum}
          />
        ))}
        {songs.items.length > LAST_LISTED_RANK ? (
          <Pressable
            onPress={onShowAll}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.showAll,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text
              variant="body"
              style={[styles.showAllLabel, { color: colors.brand }]}
            >
              Show All {songs.items.length}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brand} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  loading: {
    paddingTop: 16,
    gap: 16,
  },
  error: {
    paddingVertical: 48,
  },
  meta: {
    paddingHorizontal: 16,
  },
  section: {
    paddingTop: 20,
  },
  showAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 14,
  },
  showAllLabel: {
    ...Fonts.medium,
  },
});
