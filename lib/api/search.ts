import { api } from "./client";
import type {
  SearchArtistsResponse,
  SearchArtistsWire,
  SearchAlbumsResponse,
  SimilarArtistsResponse,
  TagSuggestionsResponse,
  TagArtistsResponse,
  TagSearchScope,
  AddArtistRequest,
  AddArtistResponse,
  DiscoveryResponse,
  EditorialLibraryAddResponse,
  EditorialLinks,
  EditorialPlaylist,
  EditorialShelfResponse,
  RecentlyAddedResponse,
  RecentReleasesResponse,
  NearbyShowsResponse,
} from "@/lib/types/search";

/**
 * Artist search through the app contract's `GET /search`, the route album
 * search uses too.
 */
export async function searchArtists(
  query: string,
  limit = 24,
): Promise<SearchArtistsResponse> {
  const r = await api.get<SearchArtistsWire>("/search", {
    params: { q: query, scope: "artist", limit },
  });
  return { artists: r.data.items.map(({ id, name }) => ({ id, name })) };
}

export async function searchAlbums(query: string, limit = 24, offset = 0) {
  const r = await api.get<SearchAlbumsResponse>("/search", {
    params: { q: query, scope: "album", limit, offset },
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

export async function getEditorialShelf() {
  const r = await api.get<EditorialShelfResponse>("/discover/editorial");
  return r.data;
}

export async function getEditorialPlaylist(playlistId: string) {
  const r = await api.get<EditorialPlaylist>(
    `/discover/editorial/${encodeURIComponent(playlistId)}`,
  );
  return r.data;
}

export async function addEditorialPlaylistToLibrary(playlistId: string) {
  const r = await api.post<EditorialLibraryAddResponse>(
    `/discover/editorial/${encodeURIComponent(playlistId)}/library`,
  );
  return r.data;
}

export async function getEditorialLinks(params: {
  artist: string;
  album?: string | null;
  albumId?: string | null;
}) {
  const r = await api.get<EditorialLinks>("/discover/editorial/links", {
    params,
  });
  return r.data;
}

export async function getNearbyShows(
  zipCode?: string,
  limit?: number,
): Promise<NearbyShowsResponse> {
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
