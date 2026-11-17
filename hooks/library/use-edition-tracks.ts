import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getReleaseGroupPreviews,
  getReleaseGroupTracks,
  type ReleaseGroupTrack,
} from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

export type EditionTrack = ReleaseGroupTrack & { preview_url?: string };

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
  const tracksQuery = useQuery({
    queryKey: libraryKeys.releaseGroupTracks(
      releaseGroupMbid!,
      release ?? null,
    ),
    queryFn: () => getReleaseGroupTracks(releaseGroupMbid!, release),
    enabled: shouldFetch,
    staleTime: 10 * 60 * 1000,
  });
  const previewsQuery = useQuery({
    queryKey: libraryKeys.releaseGroupPreviews(
      releaseGroupMbid!,
      release ?? null,
    ),
    queryFn: () =>
      getReleaseGroupPreviews(releaseGroupMbid!, { release, artistMbid }),
    enabled: shouldFetch,
    staleTime: 10 * 60 * 1000,
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
