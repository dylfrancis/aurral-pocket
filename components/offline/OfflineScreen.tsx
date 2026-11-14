import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { EmptyState } from "@/components/library/EmptyState";
import {
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { PlayerArtwork } from "@/components/player/PlayerArtwork";
import { MediaRow } from "@/components/ui/MediaRow";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { getFlowArtworkPath } from "@/lib/api/flow";
import { formatBytes, saveStatusLine } from "@/lib/offline/format";
import { savedAlbumRoute } from "@/lib/offline/saved-routes";
import {
  SAVED_SONGS,
  usePlaySavedSongs,
} from "@/hooks/offline/use-play-saved-songs";
import { albumCoverHints } from "@/hooks/player/queue-covers";
import { toPlayableTrack, type SavedTrack } from "@/lib/player/saved-queue";
import {
  useSavedBytes,
  useSavedItems,
  type SaveStatus,
} from "@/lib/offline/saved-library";
import { useColors } from "@/hooks/use-colors";

/**
 * Library › Offline: what's saved on the phone. It reads only the phone's own
 * record, so it opens with no connection, and each row opens a page that
 * plays from the saved files.
 */
export function OfflineScreen() {
  const colors = useColors();
  const router = useRouter();
  const saves = useSavedItems();
  const albums = saves.filter((save) => save.item.kind === "album");
  const playlists = saves.filter((save) => save.item.kind === "playlist");
  const songs = saves.flatMap((save) =>
    save.item.kind === "song" ? [{ save, song: save.item }] : [],
  );
  const savedSongs = songs.map(({ song }) => song);
  // A song saved on its own and with its album is on the phone once.
  const totalBytes = useSavedBytes();
  const playSongs = usePlaySavedSongs();
  const trackActions = useTrackActions();
  const openSongActions = (track: SavedTrack) => {
    const item = toPlayableTrack(track, SAVED_SONGS);
    if (item) trackActions.openItem(item, SAVED_SONGS);
  };

  const openSave = ({ item }: SaveStatus) => {
    if (item.kind === "album") {
      router.push(savedAlbumRoute(item));
    } else {
      router.push({ pathname: "/playlist/[id]", params: { id: item.id } });
    }
  };

  if (saves.length === 0) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.empty}
      >
        <EmptyState
          icon="arrow-down-circle-outline"
          message="Albums, playlists and songs you save show up here, and play without a connection."
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <Text variant="caption" style={[styles.total, { color: colors.subtle }]}>
        {`${formatBytes(totalBytes)} on this phone`}
      </Text>
      {albums.length > 0 ? (
        <Section title="Albums">
          {albums.map((save) =>
            save.item.kind === "album" ? (
              <MediaRow
                key={save.item.id}
                imageType="album"
                mbid={save.item.route.albumMbid}
                coverUrl={save.item.route.coverUrl || undefined}
                title={save.item.route.title}
                subtitle={subtitleOf(save, save.item.route.artistName)}
                onPress={() => openSave(save)}
              />
            ) : null,
          )}
        </Section>
      ) : null}
      {playlists.length > 0 ? (
        <Section title="Playlists">
          {playlists.map((save) =>
            save.item.kind === "playlist" ? (
              <MediaRow
                key={save.item.id}
                imageType="album"
                coverUrl={getFlowArtworkPath(
                  save.item.playlist.id,
                  save.item.playlist.artworkRevision,
                )}
                title={save.item.playlist.name}
                subtitle={subtitleOf(
                  save,
                  `${save.total} track${save.total === 1 ? "" : "s"}`,
                )}
                onPress={() => openSave(save)}
              />
            ) : null,
          )}
        </Section>
      ) : null}
      {songs.length > 0 ? (
        <Section title="Songs">
          {songs.map(({ save, song }) => (
            <MediaRow
              key={song.id}
              image={<SongArtwork track={song.track} />}
              title={song.track.title}
              subtitle={subtitleOf(save, song.track.artist)}
              showChevron={false}
              trailing={
                <TrackMenuButton
                  trackName={song.track.title}
                  onPress={() => openSongActions(song.track)}
                />
              }
              onPress={() => void playSongs(savedSongs, song.id)}
              onLongPress={() => openSongActions(song.track)}
            />
          ))}
        </Section>
      ) : null}
      <TrackActionsSheet
        target={trackActions.target}
        onClose={trackActions.close}
      />
    </ScrollView>
  );
}

/**
 * A song's art as the player draws it: its server cover, then the image it
 * was saved with. A song saved with neither is looked up by album, with the
 * names the lookup needs.
 */
function SongArtwork({ track }: { track: SavedTrack }) {
  if (track.coverPath || track.artwork) {
    return (
      <PlayerArtwork
        url={track.artwork}
        coverPath={track.coverPath}
        size={SONG_ART_SIZE}
        borderRadius={6}
      />
    );
  }
  return (
    <CoverArtImage
      type="album"
      mbid={track.albumMbid ?? ""}
      hints={albumCoverHints(track)}
      size={SONG_ART_SIZE}
      borderRadius={6}
    />
  );
}

/** While it saves, the row says so; once saved, it gives the size. */
function subtitleOf(save: SaveStatus, lead: string): string {
  const status = saveStatusLine(save);
  if (status) return status;
  return [lead, formatBytes(save.bytes)].filter(Boolean).join(" · ");
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text
        variant="caption"
        style={[styles.sectionTitle, { color: colors.subtle }]}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

/** MediaRow's album thumbnail. */
const SONG_ART_SIZE = 56;

const styles = StyleSheet.create({
  // Not stretched and centered: iOS adds the header's and tab bar's insets on
  // top, which left it low and scrolling.
  empty: {
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  total: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    paddingTop: 16,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    ...Fonts.medium,
  },
});
