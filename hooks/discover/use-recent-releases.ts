import { useQuery } from "@tanstack/react-query";
import { getRecentReleases } from "@/lib/api/search";
import { discoverKeys } from "@/lib/query-keys";

export function useRecentReleases() {
  return useQuery({
    queryKey: discoverKeys.recentReleases(),
    queryFn: () => getRecentReleases(),
    staleTime: 15 * 60 * 1000,
    gcTime: 45 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });
}
