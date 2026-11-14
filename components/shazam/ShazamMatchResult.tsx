import {
  AddToPlaylistSheet,
  useAddToPlaylist,
} from "@/components/flow/AddToPlaylistSheet";
import { EmptyState } from "@/components/library/EmptyState";
import {
  libraryPlaylistTrack,
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { Chip } from "@/components/ui/Chip";
import { Separator } from "@/components/ui/Separator";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useCoverArtUrl } from "@/hooks/library/use-cover-art-url";
import { usePlayTrack } from "@/hooks/library/use-play-track";
import { useAddArtist } from "@/hooks/search/use-add-artist";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useMatchDetails } from "@/hooks/shazam/use-match-details";
import { releaseRouteParams } from "@/lib/library-read";
import {
  librarySongAlbum,
  librarySongTrack,
  type MatchAlbum,
} from "@/lib/shazam/match-details";
import type { SearchArtist } from "@/lib/types/search";
import type { ShazamMatch } from "@/modules/shazam";
import { Ionicons } from "@expo/vector-icons";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export type ReleaseRoute = ReturnType<typeof releaseRouteParams>;

type Props = {
  match: ShazamMatch;
  onViewArtist: (mbid: string, name: string) => void;
  onViewRelease: (params: ReleaseRoute) => void;
  onSearchManually: (query: string) => void;
  onResolved?: (needsExpandedSheet: boolean) => void;
};

export function ShazamMatchResult({
  match,
  onViewArtist,
  onViewRelease,
  onSearchManually,
  onResolved,
}: Props) {
  const colors = useColors();
  const hasPermission = useHasPermission();
  const canAddArtist = hasPermission("addArtist");
  const addToPlaylist = useAddToPlaylist();
  const trackActions = useTrackActions();
  const play = usePlayTrack();

  const details = useMatchDetails(match);
  const artists = details?.artists ?? [];
  const { isInLibrary } = useLibraryLookup(artists.map((artist) => artist.id));

  // The library's copy plays alone, from its own file.
  const song = useMemo(() => {
    const found = details?.librarySong;
    if (!found) return null;
    const track = librarySongTrack(found);
    const album = librarySongAlbum(found, match.artworkUrl);
    return { track, album, playlistTrack: libraryPlaylistTrack(track, album) };
  }, [details?.librarySong, match.artworkUrl]);
  const playlistTrack = song ? song.playlistTrack : details?.playlistTrack;

  const settled = details !== null;
  const album = details?.album ?? null;
  // One row fits the compact sheet, and the empty state counts as one.
  const needsExpandedSheet = Math.max(artists.length, 1) + (album ? 1 : 0) > 1;
  useEffect(() => {
    if (settled) onResolved?.(needsExpandedSheet);
  }, [settled, needsExpandedSheet, onResolved]);

  const addArtist = useAddArtist();

  const handleAdd = useCallback(
    (artist: SearchArtist) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addArtist.mutate(
        {
          foreignArtistId: artist.id,
          artistName: artist.name,
          monitorOption: "all",
        },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Burnt.toast({
              title: `Added ${artist.name}`,
              message: "Now in your library",
              preset: "done",
            });
          },
          onError: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Burnt.toast({
              title: "Couldn't add artist",
              message: "Please try again",
              preset: "error",
            });
          },
        },
      );
    },
    [addArtist],
  );

  const openSongActions = song
    ? () => trackActions.open(song.track, song.album)
    : undefined;

  const handleViewAlbum = useCallback(
    (target: MatchAlbum) => {
      onViewRelease(
        releaseRouteParams({
          mbid: target.mbid,
          title: target.title,
          artistName: target.artistName,
          artistMbid: target.artistMbid,
          releaseDate: target.year,
          // The page would otherwise offer to add an album already held.
          status: target.inLibrary ? "available" : undefined,
        }),
      );
    },
    [onViewRelease],
  );

  const albumTitle =
    album?.title ?? details?.librarySong?.albumTitle ?? match.album;
  const credit = [match.artist, albumTitle].filter(Boolean).join(" · ");

  return (
    <View>
      <Pressable
        style={styles.header}
        onLongPress={openSongActions}
        accessible={false}
      >
        {match.artworkUrl ? (
          <Image
            source={{ uri: match.artworkUrl }}
            style={[styles.artwork, { backgroundColor: colors.card }]}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={[
              styles.artwork,
              styles.artworkPlaceholder,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons name="musical-notes" size={28} color={colors.subtle} />
          </View>
        )}
        <View style={styles.headerMeta}>
          <Text variant="caption" style={{ color: colors.brand }}>
            Identified
          </Text>
          <Text variant="title" numberOfLines={2} style={styles.songTitle}>
            {match.title}
          </Text>
          {!!credit && (
            <Text
              variant="caption"
              numberOfLines={1}
              style={{ color: colors.subtle }}
            >
              {credit}
            </Text>
          )}
          {settled && (
            <SongActions
              title={match.title}
              onPlay={
                song
                  ? () => void play([song.track], song.track, song.album)
                  : null
              }
              onAddToPlaylist={
                addToPlaylist.canAddToPlaylist && playlistTrack
                  ? () => addToPlaylist.open(playlistTrack)
                  : null
              }
              onMore={openSongActions ?? null}
            />
          )}
        </View>
      </Pressable>

      <Separator style={styles.divider} />

      {!details ? (
        <ActivityIndicator style={styles.loader} color={colors.brand} />
      ) : (
        <>
          {artists.length === 0 ? (
            <EmptyState
              icon="person-outline"
              message={
                !details.artistQuery
                  ? "Shazam named no artist for this song"
                  : details.artistSearchFailed
                    ? `Couldn't search for “${details.artistQuery}”`
                    : `No artists match “${details.artistQuery}”`
              }
              actionLabel={details.artistQuery ? "Search manually" : undefined}
              onAction={() => onSearchManually(details.artistQuery)}
            />
          ) : (
            <View>
              <Text
                variant="caption"
                style={[styles.sectionLabel, { color: colors.subtle }]}
              >
                {artists.length === 1 ? "Artist" : "Artists"}
              </Text>
              <Text
                variant="caption"
                style={[styles.sectionCaption, { color: colors.subtle }]}
              >
                {details.artistsFromSearch
                  ? `Top matches for “${details.artistQuery}”. Tap a row to view, or Add to your library.`
                  : "Identified from the song. Tap to view, or Add to your library."}
              </Text>
              {artists.map((artist) => (
                <ArtistCandidateRow
                  key={artist.id}
                  artist={artist}
                  inLibrary={isInLibrary(artist.id)}
                  canAdd={canAddArtist}
                  isAdding={
                    addArtist.isPending &&
                    addArtist.variables?.foreignArtistId === artist.id
                  }
                  wasAdded={
                    addArtist.isSuccess &&
                    addArtist.variables?.foreignArtistId === artist.id
                  }
                  onAdd={() => handleAdd(artist)}
                  onView={() => onViewArtist(artist.id, artist.name)}
                />
              ))}
            </View>
          )}
          {album && (
            <View>
              <Text
                variant="caption"
                style={[
                  styles.sectionLabel,
                  styles.albumLabel,
                  { color: colors.subtle },
                ]}
              >
                Album
              </Text>
              <AlbumRow album={album} onPress={() => handleViewAlbum(album)} />
            </View>
          )}
        </>
      )}

      <TrackActionsSheet
        target={trackActions.target}
        onClose={trackActions.close}
      />
      <AddToPlaylistSheet
        track={addToPlaylist.track}
        onClose={addToPlaylist.close}
      />
    </View>
  );
}

/**
 * Play needs the library's copy; Add to Playlist works either way, because
 * adding a song the library lacks queues its download.
 */
function SongActions({
  title,
  onPlay,
  onAddToPlaylist,
  onMore,
}: {
  title: string;
  onPlay: (() => void) | null;
  onAddToPlaylist: (() => void) | null;
  onMore: (() => void) | null;
}) {
  const colors = useColors();
  if (!onPlay && !onAddToPlaylist) return null;

  return (
    <View style={styles.songActions}>
      {onPlay && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play ${title}`}
          onPress={onPlay}
          style={({ pressed }) => [
            styles.songButton,
            { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="play" size={15} color={colors.buttonPrimaryText} />
          <Text
            variant="caption"
            style={[styles.songButtonText, { color: colors.buttonPrimaryText }]}
          >
            Play
          </Text>
        </Pressable>
      )}
      {onAddToPlaylist && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${title} to a playlist`}
          onPress={onAddToPlaylist}
          style={({ pressed }) => [
            styles.songButton,
            onPlay
              ? { backgroundColor: colors.brandMuted }
              : { backgroundColor: colors.brand },
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons
            name="add"
            size={16}
            color={onPlay ? colors.brandStrong : colors.buttonPrimaryText}
          />
          <Text
            variant="caption"
            style={[
              styles.songButtonText,
              {
                color: onPlay ? colors.brandStrong : colors.buttonPrimaryText,
              },
            ]}
          >
            {onPlay ? "Playlist" : "Add to Playlist"}
          </Text>
        </Pressable>
      )}
      {onMore && <TrackMenuButton trackName={title} onPress={onMore} />}
    </View>
  );
}

function ArtistCandidateRow({
  artist,
  inLibrary,
  canAdd,
  isAdding,
  wasAdded,
  onAdd,
  onView,
}: {
  artist: SearchArtist;
  inLibrary: boolean;
  canAdd: boolean;
  isAdding: boolean;
  wasAdded: boolean;
  onAdd: () => void;
  onView: () => void;
}) {
  const colors = useColors();
  const added = inLibrary || wasAdded;

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      <Pressable
        style={({ pressed }) => [
          styles.rowMain,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={onView}
      >
        {/* Search candidates carry no artwork (see SearchArtist). */}
        <View
          style={[
            styles.rowThumb,
            styles.rowThumbPlaceholder,
            { backgroundColor: colors.card },
          ]}
        >
          <Ionicons name="person-outline" size={18} color={colors.subtle} />
        </View>
        <View style={styles.rowText}>
          <Text variant="body" numberOfLines={1} style={styles.rowTitle}>
            {artist.name}
          </Text>
          {!!artist.disambiguation && (
            <Text
              variant="caption"
              numberOfLines={1}
              style={{ color: colors.subtle }}
            >
              {artist.disambiguation}
            </Text>
          )}
        </View>
      </Pressable>

      {added ? (
        <Chip label="In Library" variant="brand" />
      ) : canAdd ? (
        <Pressable
          onPress={onAdd}
          disabled={isAdding}
          accessibilityRole="button"
          accessibilityLabel={`Add ${artist.name}`}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {isAdding ? (
            <ActivityIndicator size={14} color={colors.buttonPrimaryText} />
          ) : (
            <>
              <Ionicons name="add" size={16} color={colors.buttonPrimaryText} />
              <Text
                variant="caption"
                style={[
                  styles.addButtonText,
                  { color: colors.buttonPrimaryText },
                ]}
              >
                Add
              </Text>
            </>
          )}
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
      )}
    </View>
  );
}

function AlbumRow({
  album,
  onPress,
}: {
  album: MatchAlbum;
  onPress: () => void;
}) {
  const colors = useColors();
  const { url: coverUrl } = useCoverArtUrl({
    type: "album",
    mbid: album.mbid,
    hints: { artistName: album.artistName, albumTitle: album.title },
  });
  const label = album.year ? `${album.title} · ${album.year}` : album.title;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={[styles.albumThumb, { backgroundColor: colors.card }]}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={[
            styles.albumThumb,
            styles.rowThumbPlaceholder,
            { backgroundColor: colors.card },
          ]}
        >
          <Ionicons name="disc-outline" size={18} color={colors.subtle} />
        </View>
      )}
      <Text variant="body" numberOfLines={1} style={styles.rowName}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  artwork: {
    width: 96,
    height: 96,
    borderRadius: 10,
  },
  artworkPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerMeta: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  songTitle: {
    fontSize: 20,
    lineHeight: 26,
    ...Fonts.bold,
  },
  songActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  songButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  songButtonText: {
    ...Fonts.semiBold,
  },
  divider: {
    marginBottom: 8,
  },
  sectionLabel: {
    ...Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  albumLabel: {
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionCaption: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    lineHeight: 18,
  },
  loader: {
    paddingVertical: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  rowThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    flex: 1,
    ...Fonts.medium,
  },
  rowTitle: {
    ...Fonts.medium,
  },
  albumThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    ...Fonts.semiBold,
  },
});
