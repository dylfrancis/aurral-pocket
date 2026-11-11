import { useMemo } from "react";
import { useDiscovery } from "@/hooks/discover";
import { recommendationContext } from "@/lib/discover/recommended";
import type { BasedOnArtist, DiscoveryArtist } from "@/lib/types/search";

const NO_ARTISTS: DiscoveryArtist[] = [];
const NO_SEEDS: BasedOnArtist[] = [];
const NO_GENRES: string[] = [];

export function useRecommendations() {
  const { data, dataUpdatedAt, isLoading, isError, refetch } = useDiscovery();
  const recommendations = data?.recommendations ?? NO_ARTISTS;
  const basedOn = data?.basedOn ?? NO_SEEDS;
  const topGenres = data?.topGenres ?? NO_GENRES;

  // Discover stays mounted for the app's life, so "new" is measured from the
  // latest fetch, not from when the screen mounted.
  const context = useMemo(
    () => recommendationContext(recommendations, basedOn, dataUpdatedAt),
    [recommendations, basedOn, dataUpdatedAt],
  );

  return { isLoading, isError, refetch, recommendations, topGenres, context };
}
