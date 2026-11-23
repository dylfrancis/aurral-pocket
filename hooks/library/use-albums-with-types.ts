import { useMemo } from "react";
import { useArtistDetails } from "@/hooks/library/use-artist-details";
import type {
  Album,
  PrimaryReleaseType,
  SecondaryReleaseType,
  ReleaseGroup,
} from "@/lib/types/library";

type Options = {
  /**
   * Release groups to use for enrichment. When provided, the hook skips its
   * own `useArtistDetails` read.
   */
  releaseGroups?: ReleaseGroup[];
};

/**
 * Adds release types to library albums from their matching release groups,
 * since Library rows carry none. Types already on an album win.
 */
export function useAlbumsWithTypes(
  mbid: string | undefined,
  albums: Album[] | undefined,
  options: Options = {},
) {
  const hasOverride = options.releaseGroups !== undefined;
  const detailsQuery = useArtistDetails(hasOverride ? undefined : mbid);
  const releaseGroups =
    options.releaseGroups ?? detailsQuery.data?.["release-groups"];
  const isLoadingTypes = hasOverride ? false : detailsQuery.isLoading;

  const enriched = useMemo(() => {
    if (!albums) return undefined;

    const rgMap = new Map<string, ReleaseGroup>();
    if (releaseGroups) {
      for (const rg of releaseGroups) {
        rgMap.set(rg.id, rg);
      }
    }

    return albums.map((album) => {
      const rg = rgMap.get(album.mbid);
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
    const libraryMbids = new Set(albums?.map((a) => a.mbid));
    return releaseGroups.filter((rg) => !libraryMbids.has(rg.id));
  }, [releaseGroups, albums]);

  return {
    albums: enriched,
    otherReleases,
    isLoadingTypes,
  };
}
