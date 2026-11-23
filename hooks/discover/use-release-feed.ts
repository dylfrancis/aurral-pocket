import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { getReleaseFeed } from "@/lib/api/search";
import { discoverKeys } from "@/lib/query-keys";
import type {
  RecentReleaseAlbum,
  ReleaseFeedResponse,
  ReleaseWindow,
} from "@/lib/types/search";

/** The web's page size. */
export const RELEASE_FEED_PAGE_SIZE = 24;

/**
 * The pages in order, without a release an earlier page already carried:
 * offsets shift when a metadata refresh lands between reads.
 */
export function flattenReleaseFeed(
  data: InfiniteData<ReleaseFeedResponse> | undefined,
): RecentReleaseAlbum[] {
  const seen = new Set<string>();
  const releases: RecentReleaseAlbum[] = [];
  for (const page of data?.pages ?? []) {
    for (const release of page.releases) {
      if (seen.has(release.id)) continue;
      seen.add(release.id);
      releases.push(release);
    }
  }
  return releases;
}

export function useReleaseFeed(when: ReleaseWindow) {
  return useInfiniteQuery({
    queryKey: discoverKeys.releaseFeed(when),
    queryFn: ({ pageParam }) =>
      getReleaseFeed(when, pageParam, RELEASE_FEED_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore
        ? pages.reduce((count, page) => count + page.releases.length, 0)
        : undefined,
    staleTime: 5 * 60 * 1000,
  });
}
