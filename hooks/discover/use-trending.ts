import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { getTrendingCharts, getTrendingGenreChart } from "@/lib/api/search";
import { discoverKeys } from "@/lib/query-keys";

// Aurral reloads the charts every six hours.
const TRENDING_STALE_MS = 30 * 60 * 1000;

export function useTrendingCharts() {
  return useQuery({
    queryKey: discoverKeys.trending(),
    queryFn: () => getTrendingCharts(),
    staleTime: TRENDING_STALE_MS,
  });
}

/** The genre chart route answers 404 until Aurral has loaded that chart. */
export function isChartNotLoaded(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export function useTrendingGenreChart(genreId: string) {
  return useQuery({
    queryKey: discoverKeys.trendingGenre(genreId),
    queryFn: () => getTrendingGenreChart(genreId),
    staleTime: TRENDING_STALE_MS,
    retry: (failures, error) => !isChartNotLoaded(error) && failures < 2,
    enabled: genreId !== "",
  });
}
