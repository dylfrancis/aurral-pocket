import { useQuery } from "@tanstack/react-query";
import { getNearbyShows } from "@/lib/api/search";
import { discoverKeys } from "@/lib/query-keys";

type UseNearbyShowsOptions = {
  zipCode?: string;
  limit?: number;
};

export function useNearbyShows(options: UseNearbyShowsOptions = {}) {
  const { zipCode, limit } = options;
  return useQuery({
    queryKey: discoverKeys.nearbyShows(zipCode),
    queryFn: () => getNearbyShows(zipCode, limit),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });
}
