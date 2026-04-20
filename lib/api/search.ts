import { api } from "./client";
import type {
  SearchArtistsResponse,
  SimilarArtistsResponse,
  TagSuggestionsResponse,
  TagArtistsResponse,
  TagSearchScope,
  AddArtistRequest,
  AddArtistResponse,
  DiscoveryResponse,
  RecentlyAddedResponse,
  RecentReleasesResponse,
  NearbyShowsResponse,
} from "@/lib/types/search";

export async function searchArtists(query: string, limit = 24, offset = 0) {
  const r = await api.get<SearchArtistsResponse>("/search/artists", {
    params: { query, limit, offset },
  });
  return r.data;
}

export async function addArtist(params: AddArtistRequest) {
  const r = await api.post<AddArtistResponse>("/library/artists", params);
  return r.data;
}

export async function getTagSuggestions(query: string, limit = 10) {
  const r = await api.get<TagSuggestionsResponse>("/discover/tags", {
    params: { q: query, limit },
  });
  return r.data.tags;
}

export async function getArtistsByTag(
  tag: string,
  scope: TagSearchScope = "all",
  limit = 24,
  offset = 0,
) {
  const r = await api.get<TagArtistsResponse>("/discover/by-tag", {
    params: { tag, scope, limit, offset },
  });
  return r.data;
}

export async function getSimilarArtists(mbid: string, limit = 10) {
  const r = await api.get<SimilarArtistsResponse>(`/artists/${mbid}/similar`, {
    params: { limit },
  });
  return r.data.artists;
}

export async function getDiscovery() {
  const r = await api.get<DiscoveryResponse>("/discover");
  return r.data;
}

export async function getRecentlyAdded() {
  const r = await api.get<RecentlyAddedResponse>("/library/recent");
  return r.data;
}

export async function getRecentReleases() {
  const r = await api.get<RecentReleasesResponse>("/library/recent-releases");
  return r.data;
}

export async function getNearbyShows(zipCode?: string, limit?: number) {
  const params: Record<string, string | number> = {};
  const trimmed = zipCode?.trim();
  if (trimmed) params.zip = trimmed;
  if (Number.isFinite(limit) && (limit as number) > 0) {
    params.limit = Math.floor(limit as number);
  }
  const r = await api.get<NearbyShowsResponse>("/discover/nearby-shows", {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return r.data;
}
