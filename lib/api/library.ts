import { fetch } from "expo/fetch";
import { api } from "./client";
import type {
  Artist,
  Album,
  Track,
  CoverArtResponse,
  ReleaseGroup,
  ArtistTag,
  PreviewTrack,
  DownloadStatusMap,
  CanonicalArtistItem,
  CanonicalPage,
  CanonicalPageParams,
  LibraryReadOptions,
  LibraryScanJob,
  LibraryScanStatus,
} from "@/lib/types/library";

type ArtistDetailsResponse = {
  tags?: ArtistTag[];
  bio?: string;
  "release-groups"?: ReleaseGroup[];
};

/**
 * Build the opt-in query parameters for the canonical read path. Returns an
 * empty object on the legacy path so those requests stay byte-identical.
 *
 * `source` defaults to "all" because the server defaults it per route, and the
 * defaults disagree: /library/albums and /library/artists default to "all",
 * while the read adapter defaults to "lidarr". Sending it explicitly removes
 * the ambiguity.
 */
function readPathParams(options: LibraryReadOptions = {}) {
  if (options.readPath !== "canonical") return {};
  return { readPath: "canonical", source: options.source ?? "all" };
}

export async function getLibraryArtists(options: LibraryReadOptions = {}) {
  const params = readPathParams(options);
  const r =
    Object.keys(params).length > 0
      ? await api.get<Artist[]>("/library/artists", { params })
      : await api.get<Artist[]>("/library/artists");
  return r.data;
}

/**
 * The server has no canonical route for a single artist, so this always reads
 * the legacy path. Artists that exist only in the canonical library return 404,
 * and artists whose id is not a UUID return 400.
 */
export async function getLibraryArtist(mbid: string) {
  const r = await api.get<Artist>(`/library/artists/${mbid}`);
  return r.data;
}

/**
 * On the canonical read path the server matches `artistId` against the
 * canonical artist id or the artist MBID. A Lidarr artist id matches neither,
 * so canonical callers must pass a canonical id or an MBID.
 */
export async function getLibraryAlbums(
  artistId: string,
  options: LibraryReadOptions = {},
) {
  const r = await api.get<Album[]>("/library/albums", {
    params: { artistId, ...readPathParams(options) },
  });
  return r.data;
}

/**
 * On the canonical read path the server matches `albumId` against the
 * canonical album id, its MBID, or its foreign album id, and returns only
 * albums that have files. Responses carry `streamPath` instead of a
 * filesystem path.
 */
export async function getLibraryTracks(
  albumId: string,
  options: LibraryReadOptions = {},
) {
  const r = await api.get<Track[]>("/library/tracks", {
    params: { albumId, ...readPathParams(options) },
  });
  return r.data;
}

type CanonicalPageWire = Omit<CanonicalPage, "artists"> & {
  artists?: CanonicalArtistItem[];
};

/**
 * The field choices mirror the server's own read adapter
 * (canonicalArtistProjection in backend/services/libraryQueryService.js), so
 * both read paths present an artist the same way. A file-scanned artist can
 * carry no metadata at all: it has no MBID, no added date, and was never
 * monitored, so every fallback here must hold.
 */
function canonicalArtistToArtist(item: CanonicalArtistItem): Artist {
  const metadata = item.metadata ?? {};
  return {
    id: String(item.id),
    canonicalId: String(item.id),
    mbid: item.mbid ?? "",
    foreignArtistId:
      metadata.foreignArtistId ??
      item.mbid ??
      item.identityKey ??
      String(item.id),
    artistName: item.name ?? item.sortName ?? "",
    monitored: metadata.monitored === true,
    monitorOption: metadata.monitor ?? "none",
    addedAt: metadata.added ?? null,
    statistics: {
      albumCount: item.albumCount ?? 0,
      trackCount: item.trackCount ?? 0,
      sizeOnDisk: item.sizeOnDisk ?? 0,
    },
    sources: item.sources,
    available: item.available,
  };
}

/**
 * Read one page of the canonical library.
 *
 * Aurral 2.6.0 made `kind` and `pageSize` mandatory ("bounded reads" — the
 * route answers 400 without both), so `pageSize` always goes on the wire.
 * 100 is the server's cap, and was its default while the parameter was still
 * optional, so the fallback preserves the pre-2.6 page size.
 *
 * Nothing above this function sees a raw canonical row — see
 * CanonicalArtistItem.
 */
export async function getCanonicalLibraryPage(
  params: CanonicalPageParams,
): Promise<CanonicalPage> {
  const query: Record<string, string> = {
    kind: params.kind,
    pageSize: String(params.pageSize ?? 100),
  };
  if (params.source) query.source = params.source;
  if (params.availableOnly) query.availableOnly = "true";
  if (params.page != null) query.page = String(params.page);
  if (params.query) query.query = params.query;
  if (params.genre) query.genre = params.genre;
  if (params.sort) query.sort = params.sort;
  if (params.direction) query.direction = params.direction;
  if (params.artistId) query.artistId = params.artistId;
  if (params.albumId) query.albumId = params.albumId;

  const r = await api.get<CanonicalPageWire>("/library/canonical", {
    params: query,
  });
  return {
    ...r.data,
    artists: (r.data.artists ?? []).map(canonicalArtistToArtist),
  };
}

/** Queue a rescan of the canonical library. Returns 202 with a job id. */
export async function refreshCanonicalLibrary() {
  const r = await api.post<LibraryScanJob>("/library/refresh");
  return r.data;
}

/** Poll one queued rescan. The server returns 404 for an unknown job id. */
export async function getCanonicalLibraryRefresh(jobId: string) {
  const r = await api.get<LibraryScanStatus>(`/library/refresh/${jobId}`);
  return r.data;
}

export async function getArtistDetails(mbid: string) {
  const r = await api.get<ArtistDetailsResponse>(`/artists/${mbid}`);
  return {
    tags: r.data.tags ?? [],
    bio: r.data.bio ?? null,
    releaseGroups: r.data["release-groups"] ?? [],
  };
}

export async function getArtistCover(mbid: string) {
  const r = await api.get<CoverArtResponse>(`/artists/${mbid}/cover`);
  return r.data;
}

export async function getAlbumCover(releaseGroupMbid: string) {
  const r = await api.get<CoverArtResponse>(
    `/artists/release-group/${releaseGroupMbid}/cover`,
  );
  return r.data;
}

export async function getDownloadStatuses(albumIds: string[]) {
  let r = await api.get<DownloadStatusMap>("/library/downloads/status", {
    params: { albumIds: albumIds.join(",") },
  });
  return r.data;
}

export async function triggerAlbumSearch(albumId: string) {
  const r = await api.post("/library/downloads/album/search", { albumId });
  return r.data;
}

export async function getArtistPreviewTracks(
  mbid: string,
  artistName?: string,
) {
  const r = await api.get<{ tracks: PreviewTrack[] }>(
    `/artists/${mbid}/preview`,
    {
      params: artistName ? { artistName } : undefined,
    },
  );
  return r.data.tracks;
}

export async function refreshLibraryArtist(mbid: string) {
  const r = await api.post(`/library/artists/${mbid}/refresh`);
  return r.data;
}

export async function deleteLibraryArtist(mbid: string, deleteFiles = false) {
  const r = await api.delete(`/library/artists/${mbid}`, {
    params: { deleteFiles },
  });
  return r.data;
}

export async function updateLibraryAlbum(
  albumId: string,
  data: Partial<Album> & Record<string, unknown>,
) {
  const r = await api.put<Album>(`/library/albums/${albumId}`, data);
  return r.data;
}

export async function deleteAlbum(albumId: string, deleteFiles = false) {
  const r = await api.delete(`/library/albums/${albumId}`, {
    params: { deleteFiles },
  });
  return r.data;
}

export type ReleaseGroupTrack = {
  id?: string;
  mbid?: string;
  number: number;
  trackNumber?: number;
  position?: number;
  title: string;
  length: number | null;
  preview_url?: string;
};

type DeezerAlbumTrack = {
  id: number;
  title: string;
  track_position?: number;
  duration?: number;
  preview?: string | null;
};

async function fetchDeezerAlbumTracks(
  deezerAlbumId: string,
): Promise<ReleaseGroupTrack[]> {
  const id = deezerAlbumId.replace(/^dz-/, "");
  if (!id) return [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(
      `https://api.deezer.com/album/${id}/tracks?limit=200`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: DeezerAlbumTrack[] };
    const raw = body.data ?? [];
    return raw.map((t, i) => ({
      id: String(t.id),
      mbid: String(t.id),
      title: t.title || "",
      number: t.track_position || i + 1,
      trackNumber: t.track_position || i + 1,
      position: t.track_position || i + 1,
      length: t.duration ? t.duration * 1000 : null,
      preview_url: t.preview ?? undefined,
    }));
  } catch {
    return [];
  }
}

export type ReleaseGroupTracksParams = {
  deezerAlbumId?: string;
  artistMbid?: string;
  artistName?: string;
  albumTitle?: string;
  releaseType?: string;
  releaseDate?: string;
};

export async function getReleaseGroupTracks(
  mbid: string,
  params: ReleaseGroupTracksParams = {},
) {
  const { deezerAlbumId } = params;

  // Newer aurral backends enrich release-group tracks with Deezer preview URLs
  // server-side (better matching than we can do client-side). Pass everything
  // they can use to resolve the album and match tracks.
  const query: Record<string, string> = {};
  if (params.deezerAlbumId) query.deezerAlbumId = params.deezerAlbumId;
  if (params.artistMbid) query.artistMbid = params.artistMbid;
  if (params.artistName) query.artistName = params.artistName;
  if (params.albumTitle) query.albumTitle = params.albumTitle;
  if (params.releaseType) query.releaseType = params.releaseType;
  if (params.releaseDate) query.releaseDate = params.releaseDate;

  const r = await api.get<ReleaseGroupTrack[]>(
    `/artists/release-group/${mbid}/tracks`,
    { params: Object.keys(query).length > 0 ? query : undefined },
  );
  const tracks = r.data;

  // Fallback for older self-hosted backends that don't enrich previews: if none
  // came back and we have a Deezer album, fetch tracks straight from Deezer.
  if (deezerAlbumId && !tracks.some((t) => t.preview_url)) {
    const dzTracks = await fetchDeezerAlbumTracks(deezerAlbumId);
    if (dzTracks.length > 0) return dzTracks;
  }
  return tracks;
}

export async function searchDeezerAlbum(
  artistName: string,
  albumTitle: string,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const params = new URLSearchParams({
      q: `${artistName} ${albumTitle}`,
      limit: "5",
    });
    const response = await fetch(
      `https://api.deezer.com/search/album?${params.toString()}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: { id: number; title: string }[];
    };
    const lowerTitle = albumTitle.toLowerCase();
    const match =
      body.data?.find((a) => a.title.toLowerCase() === lowerTitle) ??
      body.data?.find(
        (a) =>
          a.title.toLowerCase().includes(lowerTitle) ||
          lowerTitle.includes(a.title.toLowerCase()),
      );
    return match ? `dz-${match.id}` : null;
  } catch {
    return null;
  }
}

export async function addLibraryAlbum(
  artistId: string,
  releaseGroupMbid: string,
  albumName: string,
) {
  const r = await api.post<Album>("/library/albums", {
    artistId,
    releaseGroupMbid,
    albumName,
  });
  return r.data;
}

export type RequestAlbumPayload = {
  albumMbid: string;
  albumName: string;
  artistMbid: string;
  artistName: string;
  triggerSearch?: boolean;
};

export type RequestAlbumResponse = {
  album?: Album;
  createdArtist?: boolean;
} & Record<string, unknown>;

export async function requestAlbumFromSearch(payload: RequestAlbumPayload) {
  const r = await api.post<RequestAlbumResponse>(
    "/library/albums/request",
    payload,
  );
  return r.data;
}
