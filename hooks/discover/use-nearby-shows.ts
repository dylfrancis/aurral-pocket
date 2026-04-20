import { useQuery } from "@tanstack/react-query";
import { getNearbyShows } from "@/lib/api/search";
import { discoverKeys } from "@/lib/query-keys";

type UseNearbyShowsOptions = {
  zipCode?: string;
  limit?: number;
  enabled?: boolean;
};

export function useNearbyShows(options: UseNearbyShowsOptions = {}) {
  const { zipCode, limit, enabled = true } = options;
  return useQuery({
    queryKey: discoverKeys.nearbyShows(zipCode, limit),
    queryFn: () => getNearbyShows(zipCode, limit),
    enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });
}
