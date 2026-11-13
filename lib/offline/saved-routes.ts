import type { SavedAlbum } from "@/lib/offline/saved-library";

/**
 * The album page as it was when the album was saved. A list of saves opens
 * this, not the library record's route: the page finds its saved tracks by
 * the same `ref`, which is what lets it play offline.
 */
export function savedAlbumRoute(save: SavedAlbum) {
  return {
    pathname: "/album/[ref]" as const,
    params: { ref: save.id, ...save.route },
  };
}
