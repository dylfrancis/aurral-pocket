import { useMemo } from "react";
import { useArtistDetailsStream } from "@/hooks/library/use-artist-details-stream";
import type {
  Album,
  PrimaryReleaseType,
  SecondaryReleaseType,
  ReleaseGroup,
} from "@/lib/types/library";

type Options = {
  /**
   * Release groups to use for enrichment. When provided, the hook skips its
   * internal `useArtistDetailsStream` fetch. ArtistDetailLayout feeds these in
   * from the SSE stream so every library album gets a correct `primary-type`,
   * not the hardcoded "Album" that the REST `/artists/:mbid` endpoint returns
   * for Lidarr-tracked artists.
   */
  releaseGroups?: ReleaseGroup[];
};

/**
 * Enriches library albums with primary type and secondary types. Prefers the
 * Lidarr-sourced `albumType` / `secondaryTypes` already on the album. Falls
 * back to matching against release groups — supplied via `options` if the
 * consumer already has them, otherwise fetched lazily via
 * `useArtistDetailsStream`.
 */
export function useAlbumsWithTypes(
  mbid: string | undefined,
  albums: Album[] | undefined,
  options: Options = {},
) {
  const hasOverride = options.releaseGroups !== undefined;
  const streamQuery = useArtistDetailsStream(hasOverride ? undefined : mbid);
  const releaseGroups =
    options.releaseGroups ?? streamQuery.data?.releaseGroups;
  const isLoadingTypes = hasOverride ? false : streamQuery.isLoading;

  const enriched = useMemo(() => {
    if (!albums) return undefined;

    const rgMap = new Map<string, ReleaseGroup>();
    if (releaseGroups) {
      for (const rg of releaseGroups) {
        rgMap.set(rg.id, rg);
      }
    }

    return albums.map((album) => {
      const rg = rgMap.get(album.mbid) ?? rgMap.get(album.foreignAlbumId);
      const albumType = (album.albumType ??
        rg?.["primary-type"] ??
        "Album") as PrimaryReleaseType;
      const secondaryTypes = (album.secondaryTypes ??
        rg?.["secondary-types"] ??
        []) as SecondaryReleaseType[];
      return { ...album, albumType, secondaryTypes };
    });
  }, [albums, releaseGroups]);

  const otherReleases = useMemo(() => {
    if (!releaseGroups) return undefined;
    const libraryMbids = new Set<string>();
    if (albums) {
      for (const a of albums) {
        libraryMbids.add(a.mbid);
        libraryMbids.add(a.foreignAlbumId);
      }
    }
    return releaseGroups.filter((rg) => !libraryMbids.has(rg.id));
  }, [releaseGroups, albums]);

  return {
    albums: enriched,
    otherReleases,
    isLoadingTypes,
  };
}
