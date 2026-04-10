import { api } from './client';
import type {
  SearchArtistsResponse,
  SimilarArtistsResponse,
  TagSuggestionsResponse,
  TagArtistsResponse,
  TagSearchScope,
  AddArtistRequest,
  AddArtistResponse,
} from '@/lib/types/search';

export async function searchArtists(query: string, limit = 24, offset = 0) {
  const r = await api.get<SearchArtistsResponse>('/search/artists', {
    params: { query, limit, offset },
  });
  return r.data;
}

export async function addArtist(params: AddArtistRequest) {
  const r = await api.post<AddArtistResponse>('/library/artists', params);
  return r.data;
}

export async function getTagSuggestions(query: string, limit = 10) {
  const r = await api.get<TagSuggestionsResponse>('/discover/tags', {
    params: { q: query, limit },
  });
  return r.data.tags;
}

export async function getArtistsByTag(tag: string, scope: TagSearchScope = 'all', limit = 24, offset = 0) {
  const r = await api.get<TagArtistsResponse>('/discover/by-tag', {
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
