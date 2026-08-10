import { useCallback } from "react";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  addDiscoveryFeedback,
  deleteDiscoveryFeedback,
  getDiscoveryFeedback,
} from "@/lib/api/discovery-feedback";
import { selectBlockedArtists } from "@/lib/blocklist";
import { discoverKeys } from "@/lib/query-keys";
import type { BlockedArtist } from "@/lib/types/discovery-feedback";

export function blocklistQueryOptions() {
  return queryOptions({
    queryKey: discoverKeys.feedback(),
    queryFn: getDiscoveryFeedback,
    // The list is derived, so the selector runs on the raw feedback rows and
    // the same cache entry stays reusable by any other feedback consumer.
    select: selectBlockedArtists,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

/**
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary.
 */
export function useBlocklistSuspense() {
  return useSuspenseQuery(blocklistQueryOptions());
}

/**
 * Non-suspense variant for screens where the blocklist is a side concern (e.g.
 * the artist detail menu). A failed fetch must not take the host screen down,
 * so it opts out of the error boundary and reports an empty list instead.
 */
export function useBlocklist() {
  const { data, ...rest } = useQuery({
    ...blocklistQueryOptions(),
    throwOnError: false,
  });
  return { ...rest, data: data ?? [] };
}

export function useBlocklistMutations() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: discoverKeys.feedback() });
    // Recommendations are filtered by the blocklist server-side, so they are
    // stale the moment a block changes.
    queryClient.invalidateQueries({ queryKey: discoverKeys.discovery() });
  }, [queryClient]);

  const blockArtist = useMutation({
    mutationFn: (artist: {
      id?: string | null;
      name: string;
      /** Where the block came from, recorded on the feedback row. */
      sourceContext?: string;
    }) =>
      addDiscoveryFeedback({
        action: "block_artist",
        artistId: artist.id ?? null,
        artistName: artist.name,
        sourceContext: artist.sourceContext ?? "blocklist",
      }),
    onSuccess: invalidate,
  });

  const unblockArtist = useMutation({
    mutationFn: (blocked: BlockedArtist) => deleteDiscoveryFeedback(blocked.id),
    onSuccess: invalidate,
  });

  return { blockArtist, unblockArtist };
}
