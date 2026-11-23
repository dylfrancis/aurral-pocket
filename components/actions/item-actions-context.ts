import { createContext, useContext } from "react";
import type { AlbumActionsTarget } from "@/components/actions/AlbumActionsSheet";
import type { ArtistActionsTarget } from "@/components/actions/ArtistActionsSheet";
import type { PlaylistActionsTarget } from "@/components/actions/PlaylistActionsSheet";

export type ItemActions = {
  openAlbum: (target: AlbumActionsTarget) => void;
  openArtist: (target: ArtistActionsTarget) => void;
  openPlaylist: (target: PlaylistActionsTarget) => void;
};

/**
 * Its own module, so tiles import no sheets. Outside a provider, as in a lone
 * component's test, a long press does nothing.
 */
export const ItemActionsContext = createContext<ItemActions>({
  openAlbum: () => {},
  openArtist: () => {},
  openPlaylist: () => {},
});

/** Opens the long-press sheet for an album, artist or playlist tile. */
export function useItemActions(): ItemActions {
  return useContext(ItemActionsContext);
}
