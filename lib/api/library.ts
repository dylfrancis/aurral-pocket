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
  CanonicalAlbumItem,
  CanonicalArtistItem,
  CanonicalPage,
  CanonicalPageParams,
  CanonicalTrackFile,
  CanonicalTrackItem,
  LibraryScanJob,
  LibraryScanStatus,
} from "@/lib/types/library";

type ArtistDetailsResponse = {
  tags?: ArtistTag[];
  bio?: string;
  "release-groups"?: ReleaseGroup[];
};

/**
 * The server has no canonical route for a single artist, so this always reads
 * the legacy path. Artists that exist only in the canonical library return 404,
 * and artists whose id is not a UUID return 400.
 */
export async function getLibraryArtist(mbid: string) {
  const r = await api.get<Artist>(`/library/artists/${mbid}`);
  return r.data;
}

type CanonicalPageWire = Omit<
  CanonicalPage,
  "artists" | "albums" | "tracks"
> & {
  artists?: CanonicalArtistItem[];
  albums?: CanonicalAlbumItem[];
  tracks?: CanonicalTrackItem[];
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
 * The field choices mirror the server's own read adapter (buildAlbum in
 * backend/services/canonicalLibraryReadAdapter.js), with one deviation:
 * percentOfTracks is the real file ratio from the counts the page route
 * adds, because the screens shipped against Lidarr's real percentages and
 * useResearchMissingAlbums reads partial progress from it.
 *
 * The canonical counts only see files Aurral can stat on its own
 * filesystem. When Lidarr's music folder is not mounted into Aurral, every
 * canonical count is 0 even though Lidarr has the files. The stored Lidarr
 * payload carries Lidarr's own statistics, and the Aurral web UI derives
 * its status dot from them. The mapper takes the larger percent of the two
 * views, so a Lidarr-complete album reads 100% and an Aurral-only album
 * keeps its real ratio. sizeOnDisk comes from Lidarr's statistics — the
 * canonical album row carries no size.
 */
function canonicalAlbumToAlbum(item: CanonicalAlbumItem): Album {
  const metadata = item.metadata ?? {};
  const lidarrStatistics = metadata.statistics ?? {};
  const trackCount = item.trackCount ?? 0;
  const trackFileCount = item.availableTrackCount ?? 0;
  const canonicalPercent =
    trackCount > 0 ? Math.round((trackFileCount / trackCount) * 100) : 0;
  return {
    id: String(item.id),
    canonicalId: String(item.id),
    artistId: item.artistId != null ? String(item.artistId) : "",
    artistName: item.albumArtist ?? "",
    mbid: item.mbid ?? item.releaseGroupMbid ?? "",
    foreignAlbumId:
      item.mbid ?? item.releaseGroupMbid ?? item.identityKey ?? String(item.id),
    albumName: item.title ?? "",
    title: item.title ?? "",
    releaseDate: item.releaseDate ?? null,
    monitored: metadata.monitored === true,
    statistics: {
      trackCount,
      trackFileCount,
      sizeOnDisk: lidarrStatistics.sizeOnDisk ?? 0,
      percentOfTracks: Math.max(
        canonicalPercent,
        lidarrStatistics.percentOfTracks ?? 0,
      ),
    },
    sources: item.sources,
    available: item.available,
  };
}

/**
 * Pick the file that represents a track on one album: an available file
 * scoped to that album, then an available unscoped file, then any file.
 * Mirrors firstAvailableFile in the server's read adapter.
 */
function firstAvailableFile(
  item: CanonicalTrackItem,
  albumId: string | undefined,
): CanonicalTrackFile | null {
  const files = item.files ?? [];
  const scoped = files.filter(
    (file) => file.albumId != null && String(file.albumId) === albumId,
  );
  const unscoped = files.filter((file) => file.albumId == null);
  return (
    scoped.find((file) => file.available) ??
    unscoped.find((file) => file.available) ??
    scoped[0] ??
    unscoped[0] ??
    null
  );
}

/**
 * The field choices mirror the server's own read adapter (buildTrack in
 * backend/services/canonicalLibraryReadAdapter.js), and streamPath mirrors
 * the canonical branch of GET /library/tracks. This is the one place the
 * client knows the canonical-stream route shape; the paged route sends raw
 * files instead of a streamPath, so the client has to derive it. One
 * deviation from buildTrack: quality maps to the recorded format string,
 * because the legacy Track type declares `quality: string | null`.
 *
 * hasFile and streamPath carry two different truths. hasFile means someone
 * has the file: Aurral, or Lidarr through the hasFile flag in the stored
 * track payload. It drives the checkmark in the track list, so the app
 * matches the web UI when Aurral cannot see Lidarr's files. streamPath and
 * available stay tied to a file Aurral can read, because Aurral cannot
 * stream a file it cannot stat.
 */
function canonicalTrackToTrack(
  item: CanonicalTrackItem,
  requestedAlbumId?: string,
): Track {
  const albumId =
    requestedAlbumId ??
    (item.albums?.[0] != null ? String(item.albums[0].albumId) : undefined);
  const relation = (item.albums ?? []).find(
    (entry) => String(entry.albumId) === albumId,
  );
  const file = firstAvailableFile(item, albumId);
  const streamable = file?.available === true;
  const hasFile = streamable || item.metadata?.hasFile === true;
  return {
    id: String(item.id),
    mbid: item.mbid ?? "",
    trackName: item.title ?? "",
    title: item.title ?? "",
    trackNumber: relation?.trackNumber ?? 0,
    hasFile,
    size: Number(file?.size ?? 0),
    quality: file?.quality?.format ?? null,
    streamPath:
      streamable && albumId
        ? `/library/canonical-stream/${encodeURIComponent(albumId)}/${encodeURIComponent(String(item.id))}`
        : null,
    streamFormat: file?.format ?? null,
    sources: item.sources,
    available: streamable,
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
    albums: (r.data.albums ?? []).map(canonicalAlbumToAlbum),
    tracks: (r.data.tracks ?? []).map((item) =>
      canonicalTrackToTrack(item, params.albumId),
    ),
  };
}

/**
 * Find one canonical artist by walking the artist pages.
 *
 * The paged route matches artistId against the canonical numeric id only,
 * and the screens hold an MBID, so the translation happens here. An MBID
 * match wins as soon as a page contains it. A reference that matches no
 * MBID falls back to a canonical-id match after the walk, because a
 * file-scanned artist has no MBID and is addressed by its canonical id.
 */
async function findCanonicalArtist(artistRef: string): Promise<Artist | null> {
  const seen: Artist[] = [];
  let page = 1;
  for (;;) {
    const result = await getCanonicalLibraryPage({
      kind: "artists",
      source: "all",
      page,
    });
    const byMbid = result.artists.find(
      (artist) => artist.mbid && artist.mbid === artistRef,
    );
    if (byMbid) return byMbid;
    seen.push(...result.artists);
    if (!result.hasMore) break;
    page += 1;
  }
  return (
    seen.find((artist) => (artist.canonicalId ?? artist.id) === artistRef) ??
    null
  );
}

/**
 * Read every album of one artist from the paged canonical route.
 *
 * `artistRef` is an artist MBID, or a canonical artist id when the artist
 * has no MBID. An artist the canonical library has not indexed yet reads as
 * an empty list — the artist screen shows no albums and keeps polling.
 */
export async function getCanonicalArtistAlbums(
  artistRef: string,
): Promise<Album[]> {
  const artist = await findCanonicalArtist(artistRef);
  if (!artist) return [];
  const artistId = artist.canonicalId ?? artist.id;
  const albums: Album[] = [];
  let page = 1;
  for (;;) {
    const result = await getCanonicalLibraryPage({
      kind: "albums",
      source: "all",
      page,
      artistId,
    });
    albums.push(...result.albums);
    if (!result.hasMore) return albums;
    page += 1;
  }
}

/**
 * Read every track of one canonical album, following the page cursor.
 * Aurral 2.6 caps a canonical read at 100 items, and box sets exceed that.
 * `canonicalAlbumId` must be the album's canonical id — the paged route
 * matches nothing else.
 */
export async function getCanonicalAlbumTracks(
  canonicalAlbumId: string,
): Promise<Track[]> {
  const tracks: Track[] = [];
  let page = 1;
  for (;;) {
    const result = await getCanonicalLibraryPage({
      kind: "tracks",
      source: "all",
      page,
      albumId: canonicalAlbumId,
    });
    tracks.push(...result.tracks);
    if (!result.hasMore) return tracks;
    page += 1;
  }
}

/** Queue a rescan of the canonical library. Returns 202 with a job id. */
export async function refreshCanonicalLibrary() {
  const r = await api.post<LibraryScanJob>("/library/refresh");
  return r.data;
}

/** Poll one queued rescan. The server returns 404 for an unknown job id. */
export async function getCanonicalLibraryRefresh(jobId: number) {
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

/** The server honors only `monitored`; it ignores every other key. */
export async function updateLibraryAlbum(
  albumId: string,
  data: Partial<Album>,
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

/**
 * POST /library/albums/request answers 201 with one shape: the resolved
 * artist and album, what got created, and whether a search started.
 */
export type RequestAlbumResponse = {
  success: boolean;
  artist: Artist;
  album: Album;
  createdArtist: boolean;
  createdAlbum: boolean;
  triggeredSearch: boolean;
  status: "available" | "searching" | "inLibrary";
  /** The route hardcodes false today; queued adds arrive elsewhere. */
  queued: boolean;
};

export async function requestAlbumFromSearch(payload: RequestAlbumPayload) {
  const r = await api.post<RequestAlbumResponse>(
    "/library/albums/request",
    payload,
  );
  return r.data;
}
