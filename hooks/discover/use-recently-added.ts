import { useQuery } from "@tanstack/react-query";
import { getRecentlyAdded } from "@/lib/api/search";
import { discoverKeys } from "@/lib/query-keys";

export function useRecentlyAdded() {
  return useQuery({
    queryKey: discoverKeys.recentlyAdded(),
    queryFn: () => getRecentlyAdded(),
    staleTime: 15 * 60 * 1000,
    gcTime: 45 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });
}
