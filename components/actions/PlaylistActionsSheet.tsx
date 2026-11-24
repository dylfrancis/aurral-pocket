import { useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as Burnt from "burnt";
import {
  ActionsSheetHeader,
  HEADER_ART_SIZE,
  PlayShuffleButtons,
} from "@/components/actions/ActionsSheetHeader";
import { EditorialArtwork } from "@/components/discover/EditorialArtwork";
import type { EditorialTrackItem } from "@/components/discover/EditorialTrackRow";
import { AppSheet, useSheet } from "@/components/ui/AppSheet";
import { SheetAction } from "@/components/ui/SheetAction";
import { Text } from "@/components/ui/Text";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import {
  useAddEditorialPlaylist,
  useEditorialPlaylist,
} from "@/hooks/discover/use-editorial-playlists";
import { usePlaylistDownloads } from "@/hooks/discover/use-playlist-downloads";
import { useOpenPlaylist } from "@/hooks/flow/use-open-playlist";
import { useQueueActions } from "@/hooks/library/use-queue-actions";
import { useStartQueue } from "@/hooks/player/use-start-queue";
import {
  editorialContext,
  editorialQueue,
} from "@/lib/discover/editorial-queue";
import { formatTrackCount } from "@/lib/discover/format";
import { useIsOffline } from "@/lib/offline/network";
import type { PlayerTrack } from "@/lib/player/track-item";
import type {
  EditorialPlaylist,
  EditorialPlaylistSummary,
} from "@/lib/types/search";

/** A Discover playlist as its card shows it: Made for You, or an editor's. */
export type PlaylistActionsTarget = EditorialPlaylistSummary;

type CloseThen = (action: () => void) => () => void;

/** Mounted while a card's long press has a target. */
export function PlaylistActionsSheet({
  target,
  onClose,
}: {
  target: PlaylistActionsTarget;
  onClose: () => void;
}) {
  const sheet = useSheet({ presented: true, onClosed: onClose });
  const { present } = sheet;
  // On every open, not just on mount: a card pressed while the sheet is still
  // closing reopens it for that card.
  useEffect(() => {
    present();
  }, [target, present]);
  const closeThen: CloseThen = (action) => () => sheet.close(action);

  const offline = useIsOffline();
  // The page's read, so a visit there has it ready.
  const {
    data: playlist,
    isPending,
    isError,
  } = useEditorialPlaylist(target.provider, target.id);
  const caption = [formatTrackCount(target.trackCount), target.curator]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppSheet sheet={sheet}>
      <View style={styles.sheet}>
        <ActionsSheetHeader
          art={
            <EditorialArtwork
              name={target.name}
              coverUrl={target.artworkUrl}
              size={HEADER_ART_SIZE}
              radius={6}
            />
          }
          title={target.name}
          subtitle={caption}
        />
        {offline ? (
          <Note>Needs a connection.</Note>
        ) : playlist ? (
          <PlaylistActions
            target={target}
            songs={editorialQueue(playlist)}
            playlist={playlist}
            closeThen={closeThen}
          />
        ) : isPending ? (
          <ActivityIndicator style={styles.loading} />
        ) : isError ? (
          <Note>{"Couldn't load this playlist."}</Note>
        ) : null}
      </View>
    </AppSheet>
  );
}

function PlaylistActions({
  target,
  songs,
  playlist,
  closeThen,
}: {
  target: PlaylistActionsTarget;
  /** The playlist's songs the Library has, which are all that play. */
  songs: PlayerTrack[];
  playlist: EditorialPlaylist;
  closeThen: CloseThen;
}) {
  const hasPermission = useHasPermission();
  const startQueue = useStartQueue();
  const queue = useQueueActions();
  const addPlaylist = useAddEditorialPlaylist(target.provider, target.id);
  const openInLibrary = useOpenPlaylist();
  const context = editorialContext(playlist);
  const items = useMemo<EditorialTrackItem[]>(
    () =>
      playlist.tracks.map((track, index) => ({
        id: `${target.provider}-${target.id}-${index}`,
        track,
      })),
    [playlist.tracks, target.provider, target.id],
  );
  // A song asked for on the page is asked for again here; the server reuses
  // the request it has.
  const downloads = usePlaylistDownloads(items);

  // Nothing else plays, so with none of its songs the sheet says why.
  const withSongs = (run: (songs: PlayerTrack[]) => unknown) =>
    closeThen(() => {
      if (songs.length === 0) {
        Burnt.toast({
          title: "None of these songs are in your Library",
          preset: "error",
        });
        return;
      }
      void run(songs);
    });

  return (
    <>
      <PlayShuffleButtons
        title={playlist.name}
        onPlay={withSongs((list) =>
          startQueue(list, context, { shuffled: false }),
        )}
        onShuffle={withSongs((list) =>
          startQueue(list, context, { shuffled: true }),
        )}
      />
      <SheetAction
        icon="play-forward-outline"
        label="Play Next"
        onPress={withSongs((list) => queue.playItemsNext(list, context))}
      />
      <SheetAction
        icon="list-outline"
        label="Add to Queue"
        onPress={withSongs((list) => queue.addItemsToQueue(list, context))}
      />
      {hasPermission("accessPlaylists") ? (
        playlist.libraryPlaylistId ? (
          <SheetAction
            icon="checkmark-circle-outline"
            label="Open in Library"
            onPress={closeThen(
              () => void openInLibrary(playlist.libraryPlaylistId!),
            )}
          />
        ) : (
          <SheetAction
            icon="add-circle-outline"
            label="Add to Library"
            disabled={addPlaylist.isPending}
            onPress={closeThen(() => addPlaylist.mutate())}
          />
        )
      ) : null}
      {hasPermission("addAlbum") && downloads.missingCount > 0 ? (
        <SheetAction
          icon="cloud-download-outline"
          label={`Download Missing Songs (${downloads.missingCount})`}
          disabled={downloads.isDownloadingMissing}
          onPress={closeThen(downloads.downloadMissing)}
        />
      ) : null}
    </>
  );
}

function Note({ children }: { children: string }) {
  return (
    <Text variant="caption" style={styles.note}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 4,
  },
  loading: {
    paddingVertical: 16,
  },
  note: {
    paddingVertical: 12,
  },
});
