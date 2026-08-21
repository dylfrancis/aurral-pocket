import type { LibraryReadOptions } from "@/lib/types/library";

/**
 * The read path the library screens use.
 *
 * The server added the canonical library in 2.5.0. It is a dedicated database
 * of owned artists, albums, and tracks, scanned from the Aurral root and from
 * the root folders that Lidarr reports. Older servers ignore the two query
 * parameters and answer from Lidarr, so this is safe to send to any server.
 *
 * `source` stays "all" until the server ships split Lidarr and Aurral
 * ownership modes. See issue #199.
 */
export const LIBRARY_READ = {
  readPath: "canonical",
  source: "all",
} as const satisfies LibraryReadOptions;

/** True when the library screens read from the canonical library. */
export const READS_CANONICAL: boolean = LIBRARY_READ.readPath === "canonical";

type ArtistReference = {
  /** The Lidarr artist id. */
  artistId?: string;
  /** The MusicBrainz artist id. */
  artistMbid?: string;
};

/**
 * Pick the identifier that addresses an artist's albums.
 *
 * The two read paths do not share an artist identifier. Lidarr ids are unique
 * to Lidarr, and the canonical library assigns its own ids. The MusicBrainz id
 * is the only identifier both understand, and the canonical route matches it,
 * so the canonical path addresses albums by MBID.
 *
 * Every caller must resolve the reference through this function. The result is
 * both the request parameter and the React Query key, so a mismatch between
 * the two would leave a cache entry that no mutation can invalidate.
 */
export function libraryAlbumsRef({
  artistId,
  artistMbid,
}: ArtistReference): string | undefined {
  if (READS_CANONICAL) return artistMbid || artistId;
  return artistId;
}

/**
 * Pick the identifier that addresses an album's tracks.
 *
 * The canonical route matches an album id, an MBID, or a foreign album id. A
 * Lidarr album id matches none of them, so the canonical path prefers the MBID.
 */
export function libraryTracksRef({
  albumId,
  albumMbid,
}: {
  albumId?: string;
  albumMbid?: string;
}): string | undefined {
  if (READS_CANONICAL) return albumMbid || albumId;
  return albumId;
}
