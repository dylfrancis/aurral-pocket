import { useMemo } from "react";
import { useArtistDetails } from "@/hooks/library/use-artist-details";
import type {
  Album,
  PrimaryReleaseType,
  SecondaryReleaseType,
  ReleaseGroup,
} from "@/lib/types/library";

/**
 * Enriches library albums with primary type and secondary types by matching
 * MBIDs against the artist's release groups. Release groups come from the
 * backend's `/artists/:mbid` endpoint, which handles MusicBrainz retry,
 * backoff, rate-limiting and caching server-side.
 */
export function useAlbumsWithTypes(
  mbid: string | undefined,
  albums: Album[] | undefined,
) {
  const { data: details, isLoading } = useArtistDetails(mbid);
  const releaseGroups = details?.releaseGroups;

  const enriched = useMemo(() => {
    if (!albums) return undefined;
    if (!releaseGroups) {
      // No release group data yet — default all to Album
      return albums.map((a) => ({
        ...a,
        albumType: "Album" as PrimaryReleaseType,
        secondaryTypes: [] as SecondaryReleaseType[],
      }));
    }

    const rgMap = new Map<string, ReleaseGroup>();
    for (const rg of releaseGroups) {
      rgMap.set(rg.id, rg);
    }

    return albums.map((album) => {
      const rg = rgMap.get(album.mbid) ?? rgMap.get(album.foreignAlbumId);
      return {
        ...album,
        albumType: (rg?.["primary-type"] ?? "Album") as PrimaryReleaseType,
        secondaryTypes: (rg?.["secondary-types"] ??
          []) as SecondaryReleaseType[],
      };
    });
  }, [albums, releaseGroups]);

  // Release groups NOT in the user's library
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
    isLoadingTypes: isLoading,
  };
}
