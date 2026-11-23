import type { AlbumActionsTarget } from "@/components/actions/AlbumActionsSheet";
import { isLibraryArtistId, libraryTracksRef } from "@/lib/library-read";
import type { SavedAlbum } from "@/lib/offline/saved-library";
import type { Album } from "@/lib/types/library";
import type {
  LibrarySearchAlbum,
  RecentReleaseAlbum,
} from "@/lib/types/search";

/**
 * A Library album's sheet. A page about one artist passes that artist, which
 * names the album's and hides Go to Artist.
 */
export function libraryAlbumTarget(
  album: Album,
  artist?: { name: string; mbid: string | null | undefined },
): AlbumActionsTarget {
  return {
    // The ref albumRouteParams gives the page, so the two share their reads.
    ref: libraryTracksRef({
      albumId: album.id,
      albumMbid: album.mbid,
      libraryAlbumId: album.canonicalId,
    }),
    mbid: album.mbid || null,
    title: album.albumName,
    artistName: artist?.name || album.artistName || "",
    artistMbid: artist?.mbid || album.artistMbid || null,
    artistId: album.artistId || null,
    coverUrl: album.coverUrl || null,
    releaseDate: album.releaseDate || null,
    showArtist: !artist,
  };
}

/** An album saved on the phone, by the ref it was saved under. */
export function savedAlbumTarget(save: SavedAlbum): AlbumActionsTarget {
  const { route } = save;
  return {
    ref: save.id,
    mbid: route.albumMbid || null,
    title: route.title,
    artistName: route.artistName,
    artistMbid: route.artistMbid || null,
    artistId: route.artistId || null,
    coverUrl: route.coverUrl || null,
    releaseDate: save.album?.releaseDate || null,
  };
}

/** An album Library search found, which only finds albums it holds. */
export function librarySearchAlbumTarget(
  album: LibrarySearchAlbum,
): AlbumActionsTarget {
  return {
    ref: album.libraryId,
    mbid: album.id,
    title: album.title,
    artistName: album.artistName,
    artistMbid: album.artistMbid,
    coverUrl: album.coverUrl,
    releaseDate: album.releaseDate,
  };
}

/** A release from Discover's feed, read as its release page reads it. */
export function recentReleaseTarget(
  album: RecentReleaseAlbum,
): AlbumActionsTarget {
  return {
    mbid: album.mbid || album.foreignAlbumId || album.id,
    title: album.albumName || album.title || "",
    artistName: album.artistName,
    artistMbid: album.artistMbid || album.foreignArtistId || null,
    // A recommended artist's release names the artist by MBID in this field.
    artistId: isLibraryArtistId(album.artistId) ? album.artistId! : null,
    coverUrl: album.coverUrl,
    releaseDate: album.releaseDate,
  };
}
