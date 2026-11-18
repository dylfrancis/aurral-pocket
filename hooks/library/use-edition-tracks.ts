import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getReleaseGroupPreviews,
  getReleaseGroupTracks,
  type ReleaseGroupTrack,
} from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

export type EditionTrack = ReleaseGroupTrack & { preview_url?: string };

const STALE_TIME = 10 * 60 * 1000;

/**
 * One edition's track list, without clips. With no `release`, the server
 * picks the edition.
 */
export function useReleaseGroupTracks(
  releaseGroupMbid: string | undefined,
  { release, enabled = true }: { release?: string; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: libraryKeys.releaseGroupTracks(
      releaseGroupMbid!,
      release ?? null,
    ),
    queryFn: () => getReleaseGroupTracks(releaseGroupMbid!, release),
    enabled: enabled && !!releaseGroupMbid,
    staleTime: STALE_TIME,
  });
}

/**
 * One edition's tracks with their clips, which load separately so the tracks
 * don't wait. With no `release`, the server picks the edition.
 */
export function useEditionTracks(
  releaseGroupMbid: string | undefined,
  {
    release,
    artistMbid,
    enabled = true,
  }: { release?: string; artistMbid?: string; enabled?: boolean },
) {
  const shouldFetch = enabled && !!releaseGroupMbid;
  const tracksQuery = useReleaseGroupTracks(releaseGroupMbid, {
    release,
    enabled,
  });
  const previewsQuery = useQuery({
    queryKey: libraryKeys.releaseGroupPreviews(
      releaseGroupMbid!,
      release ?? null,
    ),
    queryFn: () =>
      getReleaseGroupPreviews(releaseGroupMbid!, { release, artistMbid }),
    enabled: shouldFetch,
    staleTime: STALE_TIME,
  });

  const previews = previewsQuery.data;
  const tracks = useMemo<EditionTrack[] | undefined>(
    () =>
      tracksQuery.data?.map((track) => ({
        ...track,
        preview_url: previews?.[track.id]?.preview_url,
      })),
    [tracksQuery.data, previews],
  );

  return {
    tracks,
    isLoading: tracksQuery.isLoading,
    isError: tracksQuery.isError,
  };
}
