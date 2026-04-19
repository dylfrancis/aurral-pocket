import { useQuery } from "@tanstack/react-query";
import { getDiscovery } from "@/lib/api/search";
import { discoverKeys } from "@/lib/query-keys";

export function useDiscovery() {
  return useQuery({
    queryKey: discoverKeys.discovery(),
    queryFn: () => getDiscovery(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  });
}
