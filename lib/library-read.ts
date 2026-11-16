/**
 * How the library screens address Library records.
 *
 * Every caller must resolve references through the functions below. The
 * result is both the request parameter and the React Query key, so a
 * mismatch between the two would leave a cache entry that no mutation can
 * invalidate.
 */

import type { DownloadStatusMap, LibraryOwner } from "@/lib/types/library";

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
 * `lidarrAlbumId` is the only id the page sends to Lidarr's album routes. It
 * comes from `lidarrId` alone: `id` and `canonicalId` are canonical ids, and
 * Lidarr would read them as some other album. It is empty for an album Lidarr
 * does not manage, and the page hides the Lidarr actions.
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
    lidarrId?: string;
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
    lidarrAlbumId: album.lidarrId ?? "",
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

/** The status route reads an id with this prefix as a canonical album id. */
export function aurralStatusKey(canonicalId: string) {
  return `aurral:${canonicalId}`;
}

/**
 * Aurral addresses the albums it manages by canonical id. Every other album
 * goes to Lidarr, including those with no owner on record, and Lidarr needs
 * its own album id: a bare canonical id would read as some other Lidarr album.
 */
export function albumManager(album: {
  managedBy?: string | null;
  canonicalId?: string;
  lidarrId?: string;
}): { name: LibraryOwner; albumId: string } | undefined {
  if (album.managedBy === "aurral") {
    return album.canonicalId
      ? { name: "aurral", albumId: album.canonicalId }
      : undefined;
  }
  return album.lidarrId
    ? { name: "lidarr", albumId: album.lidarrId }
    : undefined;
}

export function albumStatusKey(album: Parameters<typeof albumManager>[0]) {
  const manager = albumManager(album);
  if (!manager) return undefined;
  return manager.name === "aurral"
    ? aurralStatusKey(manager.albumId)
    : manager.albumId;
}

export function albumDownloadStatus(
  statuses: DownloadStatusMap | undefined,
  album: Parameters<typeof albumStatusKey>[0],
) {
  const key = albumStatusKey(album);
  return key ? statuses?.[key]?.status : undefined;
}

/**
 * Build the route params for the release detail page — the page for an album
 * that is not in the library, reached from search results and from an
 * artist's release groups.
 *
 * Both entry points name the same thing by a release-group MBID, but they
 * hold different records: search knows the album's library status, an artist
 * page knows the Lidarr artist id that can add it. The page takes the union
 * and offers whichever actions its params support.
 */
export function releaseRouteParams(release: {
  mbid: string;
  title: string;
  artistName: string;
  artistMbid?: string | null;
  /** The Lidarr artist id, when the caller knows the artist is in Lidarr. */
  artistId?: string | null;
  primaryType?: string | null;
  secondaryTypes?: readonly string[];
  releaseDate?: string | null;
  /** Search only. Absent means the page treats the album as addable. */
  status?: string;
  /** Search only. Present when a re-search is possible. */
  libraryAlbumId?: string | null;
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
    libraryAlbumId: release.libraryAlbumId ?? "",
  };
}
