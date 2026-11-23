import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import {
  ActionsSheetHeader,
  HEADER_ART_SIZE,
  PlayShuffleButtons,
} from "@/components/actions/ActionsSheetHeader";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { AppSheet, useSheet } from "@/components/ui/AppSheet";
import { SheetAction } from "@/components/ui/SheetAction";
import { Text } from "@/components/ui/Text";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useArtistFeedback } from "@/hooks/discover/use-artist-feedback";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import { useDownloadStatuses } from "@/hooks/library/use-download-statuses";
import { useCanonicalArtist } from "@/hooks/library/use-library-artist";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import { useToggleFavorite } from "@/hooks/library/use-library-favorites";
import { readArtistSongs } from "@/hooks/library/use-play-library-songs";
import { useResearchMissingAlbums } from "@/hooks/library/use-research-missing-albums";
import { useStartQueue } from "@/hooks/player/use-start-queue";
import { useStartRadio } from "@/hooks/player/use-start-radio";
import { usePluginActions } from "@/hooks/plugins/use-plugin-actions";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { getArtistQueue } from "@/lib/api/library";
import { isValidMbid } from "@/lib/blocklist";
import { useIsOffline } from "@/lib/offline/network";
import {
  queueTrackToPlayerTrack,
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import { libraryKeys } from "@/lib/query-keys";

/** An artist as a tile shows it. */
export type ArtistActionsTarget = {
  /** An MBID, or the Library id of an artist without one, as the page takes. */
  ref: string;
  name: string;
  coverUrl?: string | null;
};

/** What the sheet hands to the provider, which outlives it. */
export type ArtistSheetHandoffs = {
  onMatch: (artist: {
    libraryArtistId: string;
    name: string;
    mbid: string | undefined;
  }) => void;
  onAddToLibrary: (artist: { mbid: string; name: string }) => void;
  /** Scans poll from the provider, so the closing toast still shows. */
  onRescan: (artist: { libraryArtistId: string; name: string }) => void;
};

type CloseThen = (action: () => void) => () => void;

/** Mounted while a tile's long press has a target. */
export function ArtistActionsSheet({
  target,
  handoffs,
  onClose,
}: {
  target: ArtistActionsTarget;
  handoffs: ArtistSheetHandoffs;
  onClose: () => void;
}) {
  const sheet = useSheet({ presented: true, onClosed: onClose });
  const { present } = sheet;
  // On every open, not just on mount: a tile pressed while the sheet is still
  // closing reopens it for that tile.
  useEffect(() => {
    present();
  }, [target, present]);
  const closeThen: CloseThen = (action) => () => sheet.close(action);

  const offline = useIsOffline();
  // Every metadata read needs the MBID. Only a Library artist has a Library id.
  const mbid = isValidMbid(target.ref) ? target.ref : undefined;
  const { isInLibrary, isLoading, isError } = useLibraryLookup([mbid]);
  const inLibrary = mbid ? isInLibrary(mbid) : true;
  // The artist page's read, so a visit there has it ready.
  const { data: albums } = useLibraryAlbums(
    inLibrary && !offline && !isLoading ? target.ref : undefined,
  );

  return (
    <AppSheet sheet={sheet}>
      <View style={styles.sheet}>
        <ActionsSheetHeader
          art={
            <CoverArtImage
              type="artist"
              mbid={mbid ?? ""}
              coverUrl={target.coverUrl}
              size={HEADER_ART_SIZE}
            />
          }
          title={target.name}
          subtitle={albums ? formatAlbumCount(albums.length) : null}
        />
        {offline ? (
          <Note>Needs a connection.</Note>
        ) : isLoading ? (
          <ActivityIndicator style={styles.loading} />
        ) : mbid && isError ? (
          // Without an answer, a Library artist would be offered as new.
          <Note>{"Couldn't check your Library. Try again."}</Note>
        ) : inLibrary ? (
          <LibraryArtistActions
            target={target}
            mbid={mbid}
            handoffs={handoffs}
            closeThen={closeThen}
          />
        ) : mbid ? (
          <NewArtistActions
            mbid={mbid}
            name={target.name}
            handoffs={handoffs}
            closeThen={closeThen}
          />
        ) : null}
      </View>
    </AppSheet>
  );
}

function LibraryArtistActions({
  target,
  mbid,
  handoffs,
  closeThen,
}: {
  target: ArtistActionsTarget;
  mbid: string | undefined;
  handoffs: ArtistSheetHandoffs;
  closeThen: CloseThen;
}) {
  const queryClient = useQueryClient();
  const hasPermission = useHasPermission();
  const { name } = target;
  const { data: artist } = useCanonicalArtist(target.ref);
  const { data: albums } = useLibraryAlbums(target.ref);
  const { data: downloadStatuses } = useDownloadStatuses(albums);
  const { missingCount, researchMissing, isResearching } =
    useResearchMissingAlbums(albums, downloadStatuses, {
      mbid: mbid ?? "",
      name,
    });
  const startQueue = useStartQueue();
  const startRadio = useStartRadio();
  const toggleFavorite = useToggleFavorite();
  const pluginActions = usePluginActions("artist", { artistId: target.ref });

  // Read at the tap: each URL carries the session token.
  const play = (shuffled: boolean) =>
    closeThen(() => {
      void (async () => {
        try {
          await playArtist(shuffled);
        } catch (error) {
          Burnt.toast({
            title: `Couldn't load ${name}`,
            message: error instanceof Error ? error.message : undefined,
            preset: "error",
          });
        }
      })();
    });
  const playArtist = async (shuffled: boolean) => {
    const items: (PlayerTrack | null)[] = mbid
      ? (
          await queryClient.fetchQuery({
            queryKey: libraryKeys.artistQueue(mbid),
            queryFn: () => getArtistQueue(mbid),
          })
        ).map((track) => queueTrackToPlayerTrack(track, null))
      : (
          await queryClient.fetchQuery({
            queryKey: libraryKeys.artistSongs(target.ref),
            queryFn: () => readArtistSongs(target.ref),
          })
        ).map((song) =>
          toPlayerTrack(song, albumTrackContext(song, queryClient)),
        );
    const context: PlayerAlbumContext = {
      albumTitle: name,
      artistName: name,
      coverPath: null,
      artworkUrl: null,
      albumMbid: null,
      artistMbid: mbid ?? null,
    };
    await startQueue(
      items.filter((item): item is PlayerTrack => item !== null),
      context,
      { shuffled },
    );
  };

  const canMatch = hasPermission("addArtist") && !!artist;
  // As on the artist page: Rescan only for files in the Library or a
  // read-only folder.
  const canRescan = !!artist?.sources?.some(
    (source) => source === "aurral" || source === "readonly",
  );
  const isFavorite = artist?.userFavorite === true;

  return (
    <>
      <PlayShuffleButtons
        title={name}
        onPlay={play(false)}
        onShuffle={play(true)}
      />
      <SheetAction
        icon="radio-outline"
        label="Start Radio"
        onPress={closeThen(
          () =>
            void startRadio({
              seed: {
                artists: [
                  {
                    id: artist?.id ?? (mbid ? null : target.ref),
                    mbid: mbid ?? null,
                  },
                ],
              },
              label: name,
            }),
        )}
      />
      {artist?.identityKey ? (
        <SheetAction
          icon={isFavorite ? "heart" : "heart-outline"}
          label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          onPress={closeThen(() =>
            toggleFavorite.mutate({
              kind: "artist",
              key: artist.identityKey!,
              starred: !isFavorite,
            }),
          )}
        />
      ) : null}
      {canMatch ? (
        <SheetAction
          icon="link-outline"
          label="Match Artist"
          onPress={closeThen(() =>
            handoffs.onMatch({ libraryArtistId: artist.id, name, mbid }),
          )}
        />
      ) : null}
      {canRescan && artist ? (
        <SheetAction
          icon="refresh-outline"
          label="Rescan Files"
          onPress={closeThen(() =>
            handoffs.onRescan({
              libraryArtistId: artist.id,
              name: artist.artistName || name,
            }),
          )}
        />
      ) : null}
      {hasPermission("addAlbum") && mbid && missingCount > 0 ? (
        <SheetAction
          icon="search-outline"
          label={`Re-search Missing (${missingCount})`}
          disabled={isResearching}
          onPress={closeThen(() => researchMissing())}
        />
      ) : null}
      {pluginActions.map((action) => (
        <SheetAction
          key={action.key}
          icon="extension-puzzle-outline"
          label={action.label}
          disabled={action.running}
          onPress={closeThen(action.run)}
        />
      ))}
      {/* The blocklist names artists by MBID. */}
      {mbid ? (
        <FeedbackActions
          mbid={mbid}
          name={name}
          showRatings={false}
          closeThen={closeThen}
        />
      ) : null}
    </>
  );
}

/** An artist the Library lacks: add them, or shape what Discover suggests. */
function NewArtistActions({
  mbid,
  name,
  handoffs,
  closeThen,
}: {
  mbid: string;
  name: string;
  handoffs: ArtistSheetHandoffs;
  closeThen: CloseThen;
}) {
  const hasPermission = useHasPermission();
  return (
    <>
      {hasPermission("addArtist") ? (
        <SheetAction
          icon="add-circle-outline"
          label="Add to Library"
          onPress={closeThen(() => handoffs.onAddToLibrary({ mbid, name }))}
        />
      ) : null}
      <FeedbackActions
        mbid={mbid}
        name={name}
        showRatings
        closeThen={closeThen}
      />
    </>
  );
}

function FeedbackActions({
  mbid,
  name,
  showRatings,
  closeThen,
}: {
  mbid: string;
  name: string;
  /** More and Less Like This, offered for artists the Library lacks. */
  showRatings: boolean;
  closeThen: CloseThen;
}) {
  const feedback = useArtistFeedback({ mbid, name }, "artist_actions");
  const isBlocked = feedback.isSet("block_artist");
  return (
    <>
      {showRatings ? (
        <>
          <SheetAction
            icon="thumbs-up-outline"
            label="More Like This"
            checked={feedback.isSet("more_like_this")}
            disabled={feedback.isPending}
            onPress={closeThen(() => feedback.toggle("more_like_this"))}
          />
          <SheetAction
            icon="thumbs-down-outline"
            label="Less Like This"
            checked={feedback.isSet("less_like_this")}
            disabled={feedback.isPending}
            onPress={closeThen(() => feedback.toggle("less_like_this"))}
          />
        </>
      ) : null}
      <SheetAction
        icon={isBlocked ? "checkmark-circle-outline" : "ban-outline"}
        label={isBlocked ? "Unblock Artist" : "Block Artist"}
        destructive={!isBlocked}
        disabled={feedback.isPending}
        onPress={closeThen(() => feedback.toggle("block_artist"))}
      />
    </>
  );
}

function formatAlbumCount(count: number) {
  return count === 1 ? "1 album" : `${count} albums`;
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
