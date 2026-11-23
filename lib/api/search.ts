import { api } from "./client";
import type {
  SearchArtistsResponse,
  SearchArtistsWire,
  CatalogSearchResponse,
  CatalogSearchWire,
  LibrarySearchResponse,
  StreamingLink,
  SimilarArtistsResponse,
  TagSuggestionsResponse,
  TagArtistsResponse,
  TagSearchScope,
  AddArtistRequest,
  AddArtistResponse,
  BrowseProvider,
  DiscoveryResponse,
  EditorialLibraryAddResponse,
  EditorialLinks,
  EditorialPlaylist,
  EditorialShelfResponse,
  EditorialShelfScope,
  MadeForYouResponse,
  RecentlyAddedResponse,
  RecentReleasesResponse,
  ReleaseFeedResponse,
  ReleaseWindow,
  NearbyShowsResponse,
  TrendingChartsResponse,
  TrendingGenreChart,
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
  return {
    artists: r.data.items.map(({ id, name, disambiguation }) => ({
      id,
      name,
      disambiguation: disambiguation || null,
    })),
  };
}

/**
 * Up to 30 catalog artists, albums and songs for `query`, the server's most. Unlike
 * `GET /search`, which answers an empty list when the metadata server is
 * down, this route says so with `status: "unavailable"`.
 */
export async function searchCatalog(
  query: string,
  limit = 30,
): Promise<CatalogSearchResponse> {
  const r = await api.get<CatalogSearchWire>("/search/unified", {
    params: { q: query, limit },
  });
  return {
    status: r.data.status,
    artists: r.data.artists.map(({ id, name, disambiguation }) => ({
      id,
      name,
      disambiguation: disambiguation || null,
    })),
    albums: r.data.albums.flatMap((album) =>
      album.id
        ? [
            {
              type: "album" as const,
              id: album.id,
              title: album.title,
              artistName: album.artistName,
              artistMbid: album.artistMbid ?? null,
              releaseDate: album.releaseDate ?? null,
              primaryType: album.primaryType ?? null,
              secondaryTypes: album.secondaryTypes ?? [],
              coverUrl: album.coverUrl ?? null,
            },
          ]
        : [],
    ),
    songs: r.data.tracks.map((song) => ({
      id: song.id,
      title: song.title,
      artistName: song.artistName,
      albumTitle: song.albumTitle,
      albumMbid: song.albumMbid ?? null,
      artistMbid: song.artistMbid ?? null,
      coverUrl: song.coverUrl ?? null,
      inLibrary: song.inLibrary,
    })),
  };
}

/**
 * Tracks in the library that match `query`. The server matches the query
 * against the title, artist and album separately, so a query that joins an
 * artist and a title finds nothing.
 */
export async function searchLibraryTracks(query: string, limit = 30) {
  return (await searchLibrary(query, limit)).tracks;
}

/**
 * Library artists, albums and songs and the user's own flows and playlists
 * that match `query`, up to `limit` of each, with the query they answer. The
 * server allows at most 30.
 */
export async function searchLibrary(query: string, limit = 30) {
  const r = await api.get<LibrarySearchResponse>("/search/library", {
    params: { q: query, limit },
  });
  const { artists, albums, tracks, playlists } = r.data;
  return { query, artists, albums, tracks, playlists };
}

/** What a Spotify, Apple Music, TIDAL, Deezer or YouTube Music link names. */
export async function resolveStreamingLink(url: string) {
  const r = await api.get<StreamingLink>("/search/link", { params: { url } });
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

/** One page of the web's Releases page: released newest first, upcoming soonest first. */
export async function getReleaseFeed(
  when: ReleaseWindow,
  offset: number,
  limit: number,
) {
  const r = await api.get<ReleaseFeedResponse>("/library/releases", {
    params: { when, offset, limit },
  });
  return r.data;
}

export async function getEditorialShelf(scope?: EditorialShelfScope) {
  const r = await api.get<EditorialShelfResponse>("/discover/playlists", {
    params: scope ? { scope } : undefined,
  });
  return r.data;
}

export async function getMadeForYou() {
  const r = await api.get<MadeForYouResponse>(
    "/discover/playlists/made-for-you",
  );
  return r.data;
}

export async function getEditorialPlaylist(
  provider: BrowseProvider,
  playlistId: string,
) {
  const r = await api.get<EditorialPlaylist>(
    `/discover/playlists/${encodeURIComponent(provider)}/${encodeURIComponent(playlistId)}`,
  );
  return r.data;
}

export async function addEditorialPlaylistToLibrary(
  provider: BrowseProvider,
  playlistId: string,
) {
  const r = await api.post<EditorialLibraryAddResponse>(
    `/discover/playlists/${encodeURIComponent(provider)}/${encodeURIComponent(playlistId)}/library`,
  );
  return r.data;
}

export async function getEditorialLinks(params: {
  artist: string;
  album?: string | null;
  albumId?: string | null;
}) {
  const r = await api.get<EditorialLinks>("/discover/playlists/links", {
    params,
  });
  return r.data;
}

export async function getTrendingCharts() {
  const r = await api.get<TrendingChartsResponse>("/discover/trending");
  return r.data;
}

export async function getTrendingGenreChart(genreId: string) {
  const r = await api.get<TrendingGenreChart>(
    `/discover/trending/genres/${encodeURIComponent(genreId)}`,
  );
  return r.data;
}

export async function getNearbyShows({
  zip,
  country,
}: {
  zip?: string;
  country?: string;
} = {}): Promise<NearbyShowsResponse> {
  const params: Record<string, string> = {};
  if (zip) params.zip = zip;
  if (country) params.country = country;
  const r = await api.get<NearbyShowsResponse>("/discover/nearby-shows", {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return r.data;
}
