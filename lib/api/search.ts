import { api } from "./client";
import type {
  SearchArtist,
  SearchArtistsResponse,
  UnifiedSearchEntry,
  UnifiedSearchMode,
  UnifiedSearchResponse,
  SearchAlbumsResponse,
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

/**
 * Aurral 2.0 deleted `GET /search/artists`; `/search/unified` replaced it.
 *
 * `unified` answers with results split across `library` and `catalog`, but
 * `catalog.artists` already contains library artists flagged `inLibrary`, so
 * reading catalog alone gives the full set with no de-duplication needed.
 */
export async function searchArtists(
  query: string,
  {
    mode = "suggest",
    limit = 24,
  }: { mode?: UnifiedSearchMode; limit?: number } = {},
): Promise<SearchArtistsResponse> {
  const r = await api.get<UnifiedSearchResponse>("/search/unified", {
    params: { q: query, mode, limit },
    // `full` searches upstream providers and is markedly slower than `suggest`;
    // Aurral's own client allows it 30s.
    timeout: mode === "full" ? 30_000 : 12_000,
  });
  return { artists: normalizeArtists(r.data?.catalog?.artists) };
}

function normalizeArtists(
  entries: UnifiedSearchEntry[] | undefined,
): SearchArtist[] {
  if (!Array.isArray(entries)) return [];
  return (
    entries
      // Every action pocket offers addresses the artist by MBID, so an entry
      // without one is not something we can render a working row for.
      .filter((entry) => entry?.id && entry.hasMbid !== false)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        sortName: entry.sortName ?? entry.name,
        inLibrary: entry.inLibrary ?? false,
        score: entry.score ?? 0,
      }))
  );
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

export type AdoptDiscoverFlowResponse = {
  success: boolean;
  flowId: string;
  alreadyAdopted?: boolean;
};

export type AdoptDiscoverStaticResponse = {
  success: boolean;
  playlistId: string;
  alreadyAdopted?: boolean;
};

export async function adoptDiscoverPlaylistAsFlow(presetId: string) {
  const r = await api.post<AdoptDiscoverFlowResponse>(
    "/discover/playlists/adopt",
    { presetId },
  );
  return r.data;
}

export async function adoptDiscoverPlaylistAsStatic(presetId: string) {
  const r = await api.post<AdoptDiscoverStaticResponse>(
    "/discover/playlists/adopt-playlist",
    { presetId },
  );
  return r.data;
}

export type AuthedImageSource = {
  uri: string;
  headers?: Record<string, string>;
};

/**
 * Authenticated image source for a discover playlist's generated cover. The
 * backend serves it from /discover/artwork/:presetId behind token auth; expo
 * passes the Bearer header for us. `version` (the discovery `lastUpdated`
 * stamp) busts the cache when the playlist is rebuilt.
 */
export function getDiscoverArtworkSource(
  presetId: string,
  token: string | null,
  version?: string | null,
): AuthedImageSource {
  const base = api.defaults.baseURL;
  const v = version ? `?v=${encodeURIComponent(version)}` : "";
  const uri = `${base}/discover/artwork/${encodeURIComponent(presetId)}${v}`;
  return token
    ? { uri, headers: { Authorization: `Bearer ${token}` } }
    : { uri };
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
