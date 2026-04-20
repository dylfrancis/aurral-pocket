import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { streamSSE } from "@/lib/sse";
import { libraryKeys } from "@/lib/query-keys";
import type { ArtistTag, ReleaseGroup } from "@/lib/types/library";

/**
 * The backend emits a placeholder `artist` event at stream open with empty
 * arrays (`tags: []`, `release-groups: []`) before any upstream fetch has
 * started. That means an empty array is *not* a reliable "no data" signal —
 * consumers must combine it with `isComplete` (set when the backend sends its
 * `complete` event, or the stream otherwise ends) to distinguish "still
 * loading" from "final, nothing here."
 */
export type ArtistDetailsPayload = {
  tags?: ArtistTag[];
  bio?: string | null;
  releaseGroups?: ReleaseGroup[];
  isComplete: boolean;
};

/**
 * Consumes the backend's `/artists/:mbid/stream` SSE endpoint, merging each
 * `artist` event into a single accumulating payload. Returns the standard
 * React Query shape so consumers (ArtistDetailLayout, useAlbumsWithTypes,
 * ArtistTags, etc.) share one in-flight stream per MBID via React Query's
 * query dedup and cache the result under `libraryKeys.artistDetails`.
 *
 * The stream handler returns real MusicBrainz release-group types, unlike
 * the plain `/artists/:mbid` REST route which hardcodes `"primary-type":
 * "Album"` for any artist already in Lidarr. Progressive updates reach
 * subscribers via `setQueryData` calls as each SSE chunk lands.
 */
export function useArtistDetailsStream(mbid: string | undefined) {
  const { serverUrl, token } = useAuth();
  const queryClient = useQueryClient();

  return useQuery<ArtistDetailsPayload>({
    queryKey: libraryKeys.artistDetails(mbid!),
    queryFn: async ({ signal, queryKey }) => {
      const url = `${serverUrl}/api/artists/${mbid}/stream`;
      const merged: Record<string, unknown> = {};
      let isComplete = false;
      const toPayload = (): ArtistDetailsPayload => ({
        tags: merged.tags as ArtistTag[] | undefined,
        bio: merged.bio as string | null | undefined,
        releaseGroups: merged["release-groups"] as ReleaseGroup[] | undefined,
        isComplete,
      });

      const authHeaders: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      try {
        for await (const evt of streamSSE(url, {
          signal,
          headers: authHeaders,
        })) {
          if (signal.aborted) break;
          if (evt.event === "complete") {
            isComplete = true;
            queryClient.setQueryData<ArtistDetailsPayload>(
              queryKey,
              toPayload(),
            );
            continue;
          }
          if (evt.event !== "artist") continue;
          try {
            const partial = JSON.parse(evt.data) as Record<string, unknown>;
            Object.assign(merged, partial);
            queryClient.setQueryData<ArtistDetailsPayload>(
              queryKey,
              toPayload(),
            );
          } catch {
            // ignore malformed chunks — server occasionally splits mid-UTF8
          }
        }
      } finally {
        isComplete = true;
        queryClient.setQueryData<ArtistDetailsPayload>(queryKey, toPayload());
      }
      return toPayload();
    },
    enabled: !!mbid && !!serverUrl && !!token,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}
