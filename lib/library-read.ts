/**
 * How the library screens address records on the canonical read path.
 *
 * Server 2.5.0 added the canonical library. It is a dedicated database of
 * owned artists, albums, and tracks, scanned from the Aurral root and from the
 * root folders that Lidarr reports.
 *
 * The screens read it through the paged `/library/canonical` route. Server
 * 2.6.0 made that route return wanted (fileless) records by default, which
 * removed the reason the screens once stayed on the legacy path (see issue
 * #199 and commit be3d497). The legacy-shaped adapter routes
 * (`?readPath=canonical`) still hardcode availableOnly on the server, so the
 * hooks drain the paged route instead — see getCanonicalArtistAlbums and
 * getCanonicalAlbumTracks. The legacy read machinery is retired (issue #214).
 *
 * The wanted-music behaviors the screens rely on hold on this path:
 *
 * - A monitored album that is still downloading arrives with available:
 *   false and percentOfTracks 0. The artist screen shows it at 0%, and
 *   useResearchMissingAlbums counts it.
 * - A track nobody has arrives with hasFile: false and a null streamPath,
 *   which drives the missing marker in TrackRow.
 * - The canonical file counts only see files Aurral can stat. When Lidarr's
 *   music folder is not mounted into Aurral, the mappers fall back to
 *   Lidarr's own statistics from the stored payload, so a Lidarr-complete
 *   album still reads as downloaded. streamPath stays null there — Aurral
 *   cannot stream a file it cannot read. See canonicalAlbumToAlbum and
 *   canonicalTrackToTrack.
 * - An artist added a minute ago appears after the next canonical scan
 *   indexes it. Until then the artist screen reads an empty album list and
 *   keeps polling.
 *
 * One exception: artist detail stays on the legacy single-artist route,
 * because the server has no canonical route for a single artist. See
 * getLibraryArtist.
 *
 * Every caller must resolve references through the functions below. The
 * result is both the request parameter and the React Query key, so a
 * mismatch between the two would leave a cache entry that no mutation can
 * invalidate.
 */

type ArtistReference = {
  /** The Lidarr artist id. */
  artistId?: string;
  /** The MusicBrainz artist id. */
  artistMbid?: string;
};

/**
 * Pick the identifier that addresses an artist's albums.
 *
 * The MusicBrainz id is the only identifier the legacy artist detail and the
 * canonical library share, so it leads. The paged canonical route itself
 * matches only canonical numeric ids, so getCanonicalArtistAlbums translates
 * the MBID by walking the artist pages. The artist-id fallback carries the
 * canonical id when a file-scanned artist has no MBID; a Lidarr id in that
 * position matches nothing and reads as an empty album list.
 */
export function libraryAlbumsRef({ artistId, artistMbid }: ArtistReference) {
  return artistMbid || artistId;
}

type AlbumReference = {
  /** The Lidarr album id. */
  albumId?: string;
  /** The MusicBrainz release-group id. */
  albumMbid?: string;
  /** The album id in the canonical library. */
  canonicalAlbumId?: string;
};

/**
 * Pick the identifier that addresses an album's tracks.
 *
 * The paged canonical route matches only the canonical album id, so it
 * leads. The fallbacks keep a caller that skipped the canonical id from
 * crashing: an MBID or Lidarr id matches nothing and reads as an empty
 * track list.
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
    albumId: album.id,
    albumMbid: album.mbid ?? "",
    canonicalAlbumId: album.canonicalId ?? "",
    title: album.albumName,
    artistName: artistName ?? album.artistName ?? "",
    artistMbid: artistMbid ?? "",
    artistId: album.artistId ?? "",
    downloadStatus: downloadStatus ?? "",
  };
}

/**
 * Build the route params for the release detail page — the page for an album
 * that is not in the library, reached from search results and from an
 * artist's release groups.
 *
 * Both entry points name the same thing by a release-group MBID, but they
 * hold different records: search knows the album's library status, an artist
 * page knows the Lidarr artist id that can add it. The page takes the union
 * and lights up whichever actions its params support.
 */
export function releaseRouteParams(release: {
  mbid: string;
  title: string;
  artistName: string;
  artistMbid?: string | null;
  /** The Lidarr artist id, when the caller knows the artist is in Lidarr. */
  artistId?: string | null;
  primaryType?: string | null;
  secondaryTypes?: string[];
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
    // Joined because expo-router flattens array params inconsistently across
    // platforms; the page splits it back.
    secondaryTypes: (release.secondaryTypes ?? []).join(","),
    releaseDate: release.releaseDate ?? "",
    status: release.status ?? "",
    libraryAlbumId: release.libraryAlbumId ?? "",
  };
}
