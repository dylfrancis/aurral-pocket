/**
 * How the library screens address Library records.
 *
 * Every caller must resolve references through the functions below. The
 * result is both the request parameter and the React Query key, so a
 * mismatch between the two would leave a cache entry that no mutation can
 * invalidate.
 */

import type { DownloadStatusMap } from "@/lib/types/library";

type ArtistReference = {
  /** The Library artist id. */
  artistId?: string;
  /** The MusicBrainz artist id. */
  artistMbid?: string;
};

/**
 * The artist's MBID, or its Library id when it has no MBID.
 * getCanonicalArtistAlbums looks an MBID up first.
 */
export function libraryAlbumsRef({ artistId, artistMbid }: ArtistReference) {
  return artistMbid || artistId;
}

/**
 * The identifier the artist route uses.
 *
 * The canonical read path leaves `mbid` null for artists it scanned from files
 * that carry no MusicBrainz id, so fall back to the identifiers the server
 * always sets. That keeps the route well formed. The artist screen still needs
 * a real MBID to load, so those artists open on its not-found state.
 */
export function artistRouteId(artist: {
  id: string;
  mbid?: string | null;
  foreignArtistId?: string | null;
}) {
  return artist.mbid || artist.foreignArtistId || artist.id;
}

type AlbumReference = {
  /** The album's `id`. */
  albumId?: string;
  /** The MusicBrainz release-group id. */
  albumMbid?: string;
  /** The album id in the canonical library. */
  canonicalAlbumId?: string;
};

/**
 * Pick the identifier that addresses an album's tracks. Only the Library
 * album id matches; an MBID fallback reads as an empty track list.
 */
export function libraryTracksRef({
  albumId,
  albumMbid,
  canonicalAlbumId,
}: AlbumReference) {
  return canonicalAlbumId || albumMbid || albumId;
}

/**
 * Build the route params for the album detail page.
 *
 * Every call site pushes through here so the `ref` path param is always the
 * value `libraryTracksRef` produces — the page keys its tracks query on it,
 * and a caller that built the reference differently would read a cache entry
 * no mutation can invalidate.
 *
 * The rest are query params the page paints from before its own reads
 * resolve. `artistName` and `artistMbid` override the album's own fields
 * because an artist screen knows the artist it is showing, while a canonical
 * album row may carry a credit string instead.
 */
export function albumRouteParams(
  album: {
    id: string;
    canonicalId?: string;
    mbid?: string;
    albumName: string;
    artistId?: string;
    artistName?: string;
    coverUrl?: string;
  },
  artistName?: string,
  artistMbid?: string,
  /**
   * The download status the calling list already resolved. The page seeds its
   * badge from it, so it cannot contradict the row that opened it while its
   * own status query is still in flight.
   */
  downloadStatus?: string,
) {
  return {
    ref: libraryTracksRef({
      albumId: album.id,
      albumMbid: album.mbid,
      canonicalAlbumId: album.canonicalId,
    })!,
    albumMbid: album.mbid ?? "",
    canonicalAlbumId: album.canonicalId ?? "",
    title: album.albumName,
    artistName: artistName ?? album.artistName ?? "",
    artistMbid: artistMbid ?? "",
    artistId: album.artistId ?? "",
    downloadStatus: downloadStatus ?? "",
    coverUrl: album.coverUrl ?? "",
  };
}

/**
 * The Library id the album actions and the download status map take. Only an
 * album Aurral manages has one: the routes answer 409 for any other.
 */
export function managedAlbumId(album: {
  managed?: boolean;
  canonicalId?: string;
}) {
  return album.managed ? album.canonicalId || undefined : undefined;
}

export function albumDownloadStatus(
  statuses: DownloadStatusMap | undefined,
  album: Parameters<typeof managedAlbumId>[0],
) {
  const albumId = managedAlbumId(album);
  return albumId ? statuses?.[albumId]?.status : undefined;
}

/**
 * Build the route params for the release page, the page for an album that is
 * not in the library. Each entry point passes what it knows of the album, and
 * the page offers the actions those params support.
 */
export function releaseRouteParams(release: {
  mbid: string;
  title: string;
  artistName: string;
  artistMbid?: string | null;
  /** The Library artist id, when the caller knows the artist is in the Library. */
  artistId?: string | null;
  primaryType?: string | null;
  secondaryTypes?: readonly string[];
  releaseDate?: string | null;
  /** Absent means the page treats the album as addable. */
  status?: string;
}) {
  return {
    mbid: release.mbid,
    title: release.title,
    artistName: release.artistName,
    artistMbid: release.artistMbid ?? "",
    artistId: release.artistId ?? "",
    primaryType: release.primaryType ?? "",
    // Joined, because expo-router does not round-trip array params the same
    // way on both platforms. The page splits it back.
    secondaryTypes: (release.secondaryTypes ?? []).join(","),
    releaseDate: release.releaseDate ?? "",
    status: release.status ?? "",
  };
}
