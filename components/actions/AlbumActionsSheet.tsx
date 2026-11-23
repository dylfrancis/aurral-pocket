import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Burnt from "burnt";
import {
  ActionsSheetHeader,
  HEADER_ART_SIZE,
  PlayShuffleButtons,
} from "@/components/actions/ActionsSheetHeader";
import type { PlaylistSelection } from "@/components/flow/AddToPlaylistSheet";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { libraryPlaylistTrack } from "@/components/library/TrackActionsSheet";
import { AppSheet, useSheet } from "@/components/ui/AppSheet";
import { SheetAction } from "@/components/ui/SheetAction";
import { Text } from "@/components/ui/Text";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useAddAlbum } from "@/hooks/library/use-add-album";
import {
  useDeleteAlbum,
  useResearchAlbum,
} from "@/hooks/library/use-album-actions";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { useLibraryAlbum } from "@/hooks/library/use-library-albums";
import { useToggleFavorite } from "@/hooks/library/use-library-favorites";
import { useLibraryTracks } from "@/hooks/library/use-library-tracks";
import { useQueueActions } from "@/hooks/library/use-queue-actions";
import { useSaveOffline } from "@/hooks/offline/use-save-offline";
import { useStartRadio } from "@/hooks/player/use-start-radio";
import { usePluginActions } from "@/hooks/plugins/use-plugin-actions";
import { albumLookupQueryOptions } from "@/hooks/search/use-library-album-lookup";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { sortByDisc } from "@/lib/album-discs";
import { getCanonicalAlbumTracks } from "@/lib/api/library";
import { getEditorialLinks } from "@/lib/api/search";
import { releaseYear } from "@/lib/date-time";
import { albumDownloadStatus } from "@/lib/library-read";
import { isOffline, useIsOffline } from "@/lib/offline/network";
import {
  saveAlbum,
  useSavedStatus,
  type SaveState,
} from "@/lib/offline/saved-library";
import type { PlayerAlbumContext } from "@/lib/player/track-item";
import { discoverKeys, libraryKeys } from "@/lib/query-keys";
import type { SharedPlaylistTrack } from "@/lib/types/flow";
import type { Track } from "@/lib/types/library";

/** An album as a tile shows it. */
export type AlbumActionsTarget = {
  /**
   * The Library album's ref, as albumRouteParams builds it. Without one the
   * sheet looks the album up by its MBID, or by name when it has none.
   */
  ref?: string;
  /** The release group. */
  mbid?: string | null;
  title: string;
  artistName: string;
  artistMbid?: string | null;
  /** The Library artist's id. */
  artistId?: string | null;
  coverUrl?: string | null;
  releaseDate?: string | null;
  /** Off on pages about the album's own artist. */
  showArtist?: boolean;
};

type CloseThen = (action: () => void) => () => void;

/** Mounted while a tile's long press has a target. */
export function AlbumActionsSheet({
  target,
  canAddToPlaylist,
  onAddToPlaylist,
  onClose,
}: {
  target: AlbumActionsTarget;
  canAddToPlaylist: boolean;
  onAddToPlaylist: (selection: PlaylistSelection) => void;
  onClose: () => void;
}) {
  const sheet = useSheet({ presented: true, onClosed: onClose });
  const { present } = sheet;
  // On every open, not just on mount: a tile pressed while the sheet is still
  // closing reopens it for that tile.
  useEffect(() => {
    present();
  }, [target, present]);
  // Once the sheet has gone, as an alert or another sheet can't open sooner.
  const closeThen: CloseThen = (action) => () => sheet.close(action);

  const offline = useIsOffline();
  // Trending charts name albums without MBIDs. Shared with the tap's lookup.
  const byName = useQuery({
    queryKey: discoverKeys.editorialLinks(
      target.artistName,
      target.title,
      null,
    ),
    queryFn: () =>
      getEditorialLinks({ artist: target.artistName, album: target.title }),
    enabled: !target.ref && !target.mbid && !offline,
    retry: false,
  });
  const mbid = target.mbid || byName.data?.albumMbid || null;
  const artistMbid = target.artistMbid || byName.data?.artistMbid || null;
  const lookup = useQuery({
    ...albumLookupQueryOptions(mbid ?? ""),
    enabled: !target.ref && !!mbid && !offline,
  });
  const libraryAlbumId = mbid ? lookup.data?.[mbid]?.libraryAlbumId : null;
  const albumRef = target.ref || libraryAlbumId || null;
  const resolving =
    !albumRef && !offline && (byName.isLoading || lookup.isLoading);
  // Without an answer, the sheet can't tell a Library album from one to add.
  const lookupFailed = !albumRef && lookup.isError;

  const year = releaseYear(target.releaseDate);
  const subtitle = [target.artistName, year].filter(Boolean).join(" · ");

  return (
    <AppSheet sheet={sheet}>
      <View style={styles.sheet}>
        <ActionsSheetHeader
          art={
            <CoverArtImage
              type="album"
              mbid={mbid ?? ""}
              coverUrl={target.coverUrl}
              size={HEADER_ART_SIZE}
              borderRadius={6}
            />
          }
          title={target.title}
          subtitle={subtitle}
        />
        {albumRef ? (
          <LibraryAlbumActions
            albumRef={albumRef}
            target={{ ...target, mbid, artistMbid }}
            canAddToPlaylist={canAddToPlaylist}
            onAddToPlaylist={onAddToPlaylist}
            closeThen={closeThen}
          />
        ) : resolving ? (
          <ActivityIndicator style={styles.loading} />
        ) : offline ? (
          <Note>Needs a connection.</Note>
        ) : lookupFailed ? (
          <Note>{"Couldn't check your Library. Try again."}</Note>
        ) : mbid ? (
          <NewAlbumActions
            target={{ ...target, mbid, artistMbid }}
            closeThen={closeThen}
          />
        ) : (
          <Note>{`Couldn't find ${target.title}.`}</Note>
        )}
      </View>
    </AppSheet>
  );
}

function LibraryAlbumActions({
  albumRef,
  target,
  canAddToPlaylist,
  onAddToPlaylist,
  closeThen,
}: {
  albumRef: string;
  target: AlbumActionsTarget;
  canAddToPlaylist: boolean;
  onAddToPlaylist: (selection: PlaylistSelection) => void;
  closeThen: CloseThen;
}) {
  const queryClient = useQueryClient();
  const offline = useIsOffline();
  const { data: album } = useLibraryAlbum(albumRef);
  const { data: tracks } = useLibraryTracks(albumRef);
  const { data: downloadStatuses } = useDownloadStatuses(
    album ? [album] : undefined,
  );
  const savedItem = useSavedStatus("album", albumRef)?.item;
  const savedTracks = savedItem?.kind === "album" ? savedItem.tracks : null;

  // The tile's artist wins, as on the album page: an artist screen knows the
  // artist it shows, while a canonical row may carry a credit string.
  const title = album?.albumName || target.title;
  const artistName = target.artistName || album?.artistName || "";
  const artistMbid = target.artistMbid || album?.artistMbid || "";
  const artistId = target.artistId || album?.artistId || "";
  const albumMbid = target.mbid || album?.mbid || "";
  const coverUrl = album?.coverUrl || target.coverUrl || "";
  const playContext: PlayerAlbumContext = {
    albumTitle: title,
    artistName,
    coverPath: coverUrl || null,
    artworkUrl: null,
    albumMbid: albumMbid || null,
    artistMbid: artistMbid || null,
    albumRef,
  };
  const artist = {
    id: artistId || undefined,
    mbid: artistMbid || undefined,
    name: artistName,
  };

  const queue = useQueueActions();
  const startRadio = useStartRadio();
  const toggleFavorite = useToggleFavorite();
  const openArtist = useOpenArtist();
  const research = useResearchAlbum({
    albumRef,
    album,
    artist,
    downloadStatus: album
      ? albumDownloadStatus(downloadStatuses, album)
      : undefined,
  });
  const deleteAlbum = useDeleteAlbum({ album, title, artist });
  const pluginActions = usePluginActions(
    "album",
    album ? { albumId: album.id } : null,
  );
  const saveable =
    tracks && tracks.some((track) => track.streamPath) ? tracks : null;
  const saveOffline = useSaveOffline({
    kind: "album",
    id: albumRef,
    title,
    save: saveable
      ? () =>
          saveAlbum({
            ref: albumRef,
            route: {
              title,
              artistName,
              artistMbid,
              albumMbid,
              coverUrl,
              libraryAlbumId: album?.canonicalId ?? "",
              artistId,
            },
            tracks: sortByDisc(saveable),
            album: album ?? undefined,
          })
      : null,
  });

  // Read at the tap when the sheet's own read hasn't answered yet. Offline,
  // only a saved album has tracks to play.
  const withTracks = (run: (tracks: Track[]) => unknown) => async () => {
    try {
      const list = isOffline()
        ? (savedTracks ?? [])
        : (tracks ??
          (await queryClient.fetchQuery({
            queryKey: libraryKeys.tracks(albumRef),
            queryFn: () => getCanonicalAlbumTracks(albumRef),
          })));
      await run(sortByDisc(list ?? []));
    } catch (error) {
      Burnt.toast({
        title: `Couldn't load ${title}`,
        message: error instanceof Error ? error.message : undefined,
        preset: "error",
      });
    }
  };
  const afterClose = (action: () => Promise<void>) =>
    closeThen(() => void action());

  const toPlaylist = (list: Track[]) => {
    const songs = list
      .filter((track) => track.streamPath)
      .map((track) => libraryPlaylistTrack(track, playContext))
      .filter((song): song is SharedPlaylistTrack => song !== null);
    if (songs.length === 0) {
      Burnt.toast({ title: "No songs to add", preset: "error" });
      return;
    }
    onAddToPlaylist({ tracks: songs, subtitle: `${title} · ${artistName}` });
  };

  const showArtist = target.showArtist !== false && !!(artistMbid || artistId);
  const saveState = saveOffline.status?.state ?? null;

  if (offline && !savedTracks) return <Note>Not saved on this phone.</Note>;

  const isFavorite = album?.userFavorite === true;
  return (
    <>
      <PlayShuffleButtons
        title={title}
        onPlay={afterClose(
          withTracks((list) => queue.playAlbum(list, playContext)),
        )}
        onShuffle={afterClose(
          withTracks((list) => queue.shuffleAlbum(list, playContext)),
        )}
      />
      <SheetAction
        icon="play-forward-outline"
        label="Play Next"
        onPress={afterClose(
          withTracks((list) => queue.playNext(list, playContext)),
        )}
      />
      <SheetAction
        icon="list-outline"
        label="Add to Queue"
        onPress={afterClose(
          withTracks((list) => queue.addToQueue(list, playContext)),
        )}
      />
      {!offline && album ? (
        <SheetAction
          icon="radio-outline"
          label="Start Radio"
          onPress={closeThen(
            () =>
              void startRadio({ seed: { albumIds: [album.id] }, label: title }),
          )}
        />
      ) : null}
      {!offline && canAddToPlaylist && artistName ? (
        <SheetAction
          icon="add-circle-outline"
          label="Add to Playlist"
          onPress={afterClose(withTracks(toPlaylist))}
        />
      ) : null}
      {!offline && album?.identityKey ? (
        <SheetAction
          icon={isFavorite ? "heart" : "heart-outline"}
          label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          onPress={closeThen(() =>
            toggleFavorite.mutate({
              kind: "album",
              key: album.identityKey!,
              starred: !isFavorite,
            }),
          )}
        />
      ) : null}
      {!offline || saveState === "saved" ? (
        <SheetAction
          icon={SAVE_ICONS[saveState ?? "none"]}
          label={SAVE_LABELS[saveState ?? "none"]}
          disabled={saveOffline.disabled}
          onPress={closeThen(saveOffline.onPress)}
        />
      ) : null}
      {!offline && showArtist ? (
        <SheetAction
          icon="person-outline"
          label="Go to Artist"
          onPress={closeThen(() =>
            openArtist({ mbid: artistMbid || artistId, name: artistName }),
          )}
        />
      ) : null}
      {!offline && research.visible ? (
        <SheetAction
          icon="search-outline"
          label={research.label}
          disabled={research.isPending}
          onPress={closeThen(research.research)}
        />
      ) : null}
      {!offline
        ? pluginActions.map((action) => (
            <SheetAction
              key={action.key}
              icon="extension-puzzle-outline"
              label={action.label}
              disabled={action.running}
              onPress={closeThen(action.run)}
            />
          ))
        : null}
      {!offline && deleteAlbum.canDelete ? (
        <SheetAction
          icon="trash-outline"
          label="Delete Album"
          destructive
          disabled={deleteAlbum.isPending}
          onPress={closeThen(deleteAlbum.confirmDelete)}
        />
      ) : null}
    </>
  );
}

/** An album the Library lacks: add it, or see its artist. */
function NewAlbumActions({
  target,
  closeThen,
}: {
  target: AlbumActionsTarget & { mbid: string };
  closeThen: CloseThen;
}) {
  const hasPermission = useHasPermission();
  const openArtist = useOpenArtist();
  const addAlbum = useAddAlbum({
    mbid: target.mbid,
    title: target.title,
    artistName: target.artistName,
    artistMbid: target.artistMbid,
    artistId: target.artistId,
  });
  const artistRef = target.artistMbid || target.artistId;
  const showArtist = target.showArtist !== false && !!artistRef;

  return (
    <>
      {hasPermission("addAlbum") ? (
        <SheetAction
          icon="add-circle-outline"
          label="Add Album"
          disabled={addAlbum.isPending}
          onPress={closeThen(addAlbum.add)}
        />
      ) : null}
      {showArtist ? (
        <SheetAction
          icon="person-outline"
          label="Go to Artist"
          onPress={closeThen(() =>
            openArtist({ mbid: artistRef, name: target.artistName }),
          )}
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

type SaveKey = SaveState | "none";

// The song sheet's words for the same states.
const SAVE_LABELS: Record<SaveKey, string> = {
  none: "Save Offline",
  saving: "Stop Saving",
  waiting: "Stop Saving",
  incomplete: "Try Saving Again",
  saved: "Remove from Phone",
};

const SAVE_ICONS: Record<SaveKey, keyof typeof Ionicons.glyphMap> = {
  none: "arrow-down-circle-outline",
  saving: "close-circle-outline",
  waiting: "close-circle-outline",
  incomplete: "refresh-outline",
  saved: "close-circle-outline",
};

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
