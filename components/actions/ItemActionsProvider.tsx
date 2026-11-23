import { useMemo, useState, type ReactNode } from "react";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import {
  AlbumActionsSheet,
  type AlbumActionsTarget,
} from "@/components/actions/AlbumActionsSheet";
import {
  ArtistActionsSheet,
  type ArtistActionsTarget,
  type ArtistSheetHandoffs,
} from "@/components/actions/ArtistActionsSheet";
import {
  PlaylistActionsSheet,
  type PlaylistActionsTarget,
} from "@/components/actions/PlaylistActionsSheet";
import {
  MatchArtistSheet,
  matchSavedTitle,
} from "@/components/artist/MatchArtistSheet";
import {
  AddToPlaylistSheet,
  useAddToPlaylist,
} from "@/components/flow/AddToPlaylistSheet";
import { AddArtistSheet } from "@/components/search/AddArtistSheet";
import {
  ItemActionsContext,
  type ItemActions,
} from "@/components/actions/item-actions-context";
import { useSheet } from "@/components/ui/AppSheet";
import { useLibraryScan } from "@/hooks/library/use-library-scan";

type Matching = { libraryArtistId: string; name: string; mbid?: string };
type Adding = { mbid: string; name: string };

/**
 * Holds the album, artist and playlist sheets once for every tab, and the
 * sheets they hand off to, which open after them and outlive them.
 */
export function ItemActionsProvider({ children }: { children: ReactNode }) {
  const [album, setAlbum] = useState<AlbumActionsTarget | null>(null);
  const [artist, setArtist] = useState<ArtistActionsTarget | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistActionsTarget | null>(null);
  const addToPlaylist = useAddToPlaylist();
  const [matching, setMatching] = useState<Matching | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const addArtistSheet = useSheet();
  const presentAddArtist = addArtistSheet.present;
  const { scan } = useLibraryScan();

  const actions = useMemo<ItemActions>(
    () => ({
      openAlbum: (target) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAlbum(target);
      },
      openArtist: (target) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setArtist(target);
      },
      openPlaylist: (target) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPlaylist(target);
      },
    }),
    [],
  );

  const handoffs = useMemo<ArtistSheetHandoffs>(
    () => ({
      onMatch: setMatching,
      onAddToLibrary: (next) => {
        setAdding(next);
        presentAddArtist();
      },
      onRescan: ({ libraryArtistId, name }) =>
        scan(
          { artistId: Number(libraryArtistId) },
          {
            started: `Rescanning ${name}`,
            done: `Rescanned ${name}`,
            failed: `Couldn't rescan ${name}`,
          },
        ),
    }),
    [presentAddArtist, scan],
  );

  return (
    <ItemActionsContext.Provider value={actions}>
      {children}
      {album ? (
        <AlbumActionsSheet
          target={album}
          canAddToPlaylist={addToPlaylist.canAddToPlaylist}
          onAddToPlaylist={addToPlaylist.openMany}
          onClose={() => setAlbum(null)}
        />
      ) : null}
      {artist ? (
        <ArtistActionsSheet
          target={artist}
          handoffs={handoffs}
          onClose={() => setArtist(null)}
        />
      ) : null}
      {playlist ? (
        <PlaylistActionsSheet
          target={playlist}
          onClose={() => setPlaylist(null)}
        />
      ) : null}
      <AddToPlaylistSheet
        selection={addToPlaylist.selection}
        onClose={addToPlaylist.close}
      />
      {matching ? (
        <MatchArtistSheet
          libraryArtistId={matching.libraryArtistId}
          artistName={matching.name}
          currentMbid={matching.mbid}
          onSaved={(result) =>
            Burnt.toast({
              title: matchSavedTitle(matching.name, result),
              preset: "done",
            })
          }
          onDismiss={() => setMatching(null)}
        />
      ) : null}
      {/* Kept once the artist is in, so the sheet can finish closing. */}
      {adding ? (
        <AddArtistSheet
          mbid={adding.mbid}
          artistName={adding.name}
          sheet={addArtistSheet}
          onAdded={() =>
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            )
          }
        />
      ) : null}
    </ItemActionsContext.Provider>
  );
}
