import { api } from "./client";
import { discOf } from "@/lib/album-discs";
import type {
  Artist,
  ArtistDetails,
  ArtistLibraryLookup,
  AlbumLookupBatch,
  ArtistLookupBatch,
  Album,
  AurralAlbumStatus,
  Track,
  CoverArtResponse,
  PreviewTrack,
  DownloadStatusMap,
  CanonicalAlbumItem,
  CanonicalArtistItem,
  CanonicalGenre,
  CanonicalPage,
  CanonicalPageParams,
  CanonicalTrackFile,
  CanonicalTrackItem,
  LibraryFavorites,
  LibraryFavoritesWire,
  LibraryScanJob,
  LibraryScanStatus,
} from "@/lib/types/library";

/**
 * Read one Library artist by MBID. An unknown artist answers 404, and an id
 * that is not a UUID answers 400.
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
 * The field choices follow buildArtist in the server's
 * backend/services/libraryReadModel.ts. A file-scanned artist can have no
 * MBID, so every fallback here must hold. Library rows carry no added date.
 */
function canonicalArtistToArtist(item: CanonicalArtistItem): Artist {
  return {
    id: String(item.id),
    canonicalId: String(item.id),
    mbid: item.mbid ?? "",
    foreignArtistId: item.mbid ?? item.identityKey ?? String(item.id),
    artistName: item.name ?? item.sortName ?? "",
    monitored: item.monitored === true,
    addedAt: null,
    statistics: {
      albumCount: item.albumCount ?? 0,
      trackCount: item.trackCount ?? 0,
      sizeOnDisk: item.sizeOnDisk ?? 0,
    },
    sources: item.sources,
    available: item.available,
    identityKey: item.identityKey,
    userFavorite: item.userFavorite,
    coverUrl: item.coverUrl ?? undefined,
  };
}

/**
 * The field choices follow buildAlbum in the server's
 * backend/services/libraryReadModel.ts, with one deviation: percentOfTracks is
 * the real file ratio from the counts the page route adds, where buildAlbum
 * reads 0 until every track has a file. The artist screen shows partial
 * progress, and useResearchMissingAlbums counts it.
 *
 * Library album rows carry no size, so sizeOnDisk is 0.
 */
function canonicalAlbumToAlbum(item: CanonicalAlbumItem): Album {
  const trackCount = item.trackCount ?? 0;
  const trackFileCount = item.availableTrackCount ?? 0;
  return {
    id: String(item.id),
    canonicalId: String(item.id),
    managed: item.managed === true,
    artistId: item.artistId != null ? String(item.artistId) : "",
    artistName: item.albumArtist ?? "",
    // A row scanned from tagged files keeps its release's id in `mbid`. Release
    // lists, cover lookups and the web's album route all use the release group.
    mbid: item.releaseGroupMbid || item.mbid || "",
    foreignAlbumId:
      item.releaseGroupMbid || item.mbid || item.identityKey || String(item.id),
    albumName: item.title ?? "",
    title: item.title ?? "",
    releaseDate: item.releaseDate ?? null,
    monitored: item.monitored === true,
    statistics: {
      trackCount,
      trackFileCount,
      sizeOnDisk: 0,
      percentOfTracks:
        trackCount > 0 ? Math.round((trackFileCount / trackCount) * 100) : 0,
    },
    sources: item.sources,
    available: item.available,
    identityKey: item.identityKey,
    userFavorite: item.userFavorite,
    coverUrl: item.coverUrl ?? undefined,
  };
}

/**
 * Pick the file that represents a track on one album: an available file
 * scoped to that album, then an available unscoped file, then any file.
 * Follows selectCanonicalFile in the server's
 * backend/services/canonicalFileSelector.ts.
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

/** The file's disc subtitle tag, which can arrive as a list. */
function discSubtitle(item: CanonicalTrackItem) {
  const [subtitle] = [item.metadata?.tags?.discsubtitle].flat();
  return typeof subtitle === "string" && subtitle.trim()
    ? subtitle.trim()
    : null;
}

/**
 * The field choices follow buildTrack in the server's
 * backend/services/libraryReadModel.ts, and streamPath follows the Library
 * branch of GET /library/tracks. This is the one place the client builds a
 * stream path; the paged route sends raw files instead of a streamPath, so
 * the client has to derive it. One deviation from buildTrack:
 * quality maps to the recorded format string, because the legacy Track type
 * declares `quality: string | null`.
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
  // The scanner records bits per second.
  const bitrate = Number(file?.quality?.bitrate);
  return {
    id: String(item.id),
    mbid: item.mbid ?? "",
    trackName: item.title ?? "",
    title: item.title ?? "",
    trackNumber: relation?.trackNumber ?? 0,
    discNumber: discOf(relation ?? {}),
    discTitle: discSubtitle(item),
    hasFile: streamable,
    size: Number(file?.size ?? 0),
    quality: file?.quality?.format ?? null,
    streamPath:
      streamable && albumId
        ? `/library/stream/${encodeURIComponent(albumId)}/${encodeURIComponent(String(item.id))}`
        : null,
    streamFormat: file?.format ?? null,
    bitrateKbps: bitrate > 0 ? Math.round(bitrate / 1000) : null,
    sources: item.sources,
    available: streamable,
    artistName: item.artistName,
    identityKey: item.identityKey,
    userFavorite: item.userFavorite,
  };
}

/**
 * Read one page of the Library.
 *
 * The route answers 400 without both `kind` and `pageSize`, so `pageSize`
 * always goes on the wire. The fallback is the server's cap of 100.
 *
 * `availableOnly` is tri-state on the wire — see CanonicalPageParams — so
 * `false` is sent, not dropped.
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
  if (params.availableOnly != null) {
    query.availableOnly = String(params.availableOnly);
  }
  if (params.page != null) query.page = String(params.page);
  if (params.query) query.query = params.query;
  if (params.genre) query.genre = params.genre;
  if (params.sort) query.sort = params.sort;
  if (params.direction) query.direction = params.direction;
  if (params.artistId) query.artistId = params.artistId;
  if (params.albumId) query.albumId = params.albumId;
  if (params.status) query.status = params.status;
  // The server takes only "true".
  if (params.favorite) query.favorite = "true";

  const r = await api.get<CanonicalPageWire>("/library", {
    params: query,
  });
  return {
    ...r.data,
    artists: (r.data.artists ?? []).map(canonicalArtistToArtist),
    albums: (r.data.albums ?? []).map(canonicalAlbumToAlbum),
    tracks: (r.data.tracks ?? []).map((item) =>
      canonicalTrackToTrack(item, params.albumId ?? streamAlbumId(item)),
    ),
  };
}

/**
 * The album a track streams from when no album was asked for. A track can sit
 * on several albums with its file on only one.
 */
function streamAlbumId(item: CanonicalTrackItem): string | undefined {
  const albumId =
    item.files?.find((file) => file.available && file.albumId != null)
      ?.albumId ?? item.albums?.[0]?.albumId;
  return albumId != null ? String(albumId) : undefined;
}

/**
 * The canonical artist id for an artist MBID, from the app contract's artist
 * lookup. Null until the canonical library indexes the artist. Wanted artists
 * count: the lookup reads every source, available or not.
 */
export async function getLibraryArtistId(mbid: string): Promise<string | null> {
  const r = await api.get<ArtistLibraryLookup>(`/library/lookup/${mbid}`);
  return r.data.libraryArtistId;
}

/** Both batch lookups answer 400 above 100 unique MBIDs. */
const LOOKUP_BATCH_MAX = 100;

function lookupBatches(mbids: string[]) {
  const batches: string[][] = [];
  for (let i = 0; i < mbids.length; i += LOOKUP_BATCH_MAX) {
    batches.push(mbids.slice(i, i + LOOKUP_BATCH_MAX));
  }
  return batches;
}

/**
 * Library membership for artist MBIDs, from the app contract's batch lookup.
 * Larger lists go out in batches the route accepts.
 */
export async function lookupLibraryArtists(
  mbids: string[],
): Promise<ArtistLookupBatch> {
  const results = await Promise.all(
    lookupBatches(mbids).map((batch) =>
      api
        .post<ArtistLookupBatch>("/library/lookup/batch", { mbids: batch })
        .then((r) => r.data),
    ),
  );
  return Object.assign({}, ...results);
}

/**
 * The Library albums behind release-group MBIDs, from the app contract's album
 * lookup. Larger lists go out in batches the route accepts.
 */
export async function lookupLibraryAlbums(
  mbids: string[],
): Promise<AlbumLookupBatch> {
  const results = await Promise.all(
    lookupBatches(mbids).map((batch) =>
      api
        .post<AlbumLookupBatch>("/library/albums/lookup/batch", {
          mbids: batch,
        })
        .then((r) => r.data),
    ),
  );
  return Object.assign({}, ...results);
}

function canonicalArtistId(artistRef: string): Promise<string | null> {
  return /^\d+$/.test(artistRef)
    ? Promise.resolve(artistRef)
    : getLibraryArtistId(artistRef);
}

/**
 * Read one artist's canonical row. The single-artist route has no cover and
 * the paged route has no single-artist read, but a page of albums carries the
 * rows of its artists. Null until the canonical library has an album for them.
 */
export async function getCanonicalArtist(
  artistRef: string,
): Promise<Artist | null> {
  const artistId = await canonicalArtistId(artistRef);
  if (!artistId) return null;
  const page = await getCanonicalLibraryPage({
    kind: "albums",
    source: "all",
    availableOnly: false,
    artistId,
    pageSize: 1,
  });
  return page.artists.find((artist) => artist.id === artistId) ?? null;
}

/**
 * Read every album of one artist from the paged canonical route.
 *
 * `artistRef` is an artist MBID, or a canonical artist id when the artist
 * has no MBID. The paged route matches canonical ids only, so an MBID goes
 * through the artist lookup first. A canonical id is numeric, which tells the
 * two apart. An artist the canonical library has not indexed yet reads as
 * an empty list — the artist screen shows no albums and keeps polling.
 *
 * Wanted albums are part of the list: the artist screen shows them as
 * missing, and useResearchMissingAlbums searches them.
 */
export async function getCanonicalArtistAlbums(
  artistRef: string,
): Promise<Album[]> {
  const artistId = await canonicalArtistId(artistRef);
  if (!artistId) return [];
  const albums: Album[] = [];
  let page = 1;
  for (;;) {
    const result = await getCanonicalLibraryPage({
      kind: "albums",
      source: "all",
      availableOnly: false,
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
 * matches nothing else. Tracks nobody has a file for are part of the list,
 * so the album page can mark them missing.
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
      availableOnly: false,
      page,
      albumId: canonicalAlbumId,
    });
    tracks.push(...result.tracks);
    if (!result.hasMore) return tracks;
    page += 1;
  }
}

/**
 * Read one canonical album by its canonical id. The paged route matches the
 * canonical numeric id only — see libraryTracksRef. An unknown id reads as
 * null. A wanted album must not, or the album page reads it as complete, so
 * the read asks for wanted records.
 */
export async function getCanonicalAlbum(
  canonicalAlbumId: string,
): Promise<Album | null> {
  const result = await getCanonicalLibraryPage({
    kind: "albums",
    source: "all",
    availableOnly: false,
    albumId: canonicalAlbumId,
    pageSize: 1,
  });
  return result.albums[0] ?? null;
}

/**
 * Read the genre statistics list. The genres kind pages `items`, but it also
 * returns the full, unpaged list in `genres` — so one bounded request reads
 * the whole list.
 */
export async function getCanonicalGenres(): Promise<CanonicalGenre[]> {
  const page = await getCanonicalLibraryPage({
    kind: "genres",
    source: "all",
    pageSize: 100,
  });
  return page.genres ?? [];
}

/**
 * The entity kinds the favorites API addresses. Library tracks are "song". A
 * flow's or shared playlist's own download is a "flow-song" or "shared-song",
 * keyed `<playlist id>:<job id>`.
 */
export type FavoriteKind =
  "artist" | "album" | "song" | "flow-song" | "shared-song";

export type TrackFavorite = {
  kind: Extract<FavoriteKind, "song" | "flow-song" | "shared-song">;
  /** A library track's identity key, or `<playlist id>:<job id>`. */
  key: string;
};

/**
 * Build the id the favorites API addresses an entity by. Mirrors subsonicId in
 * the server's libraryMediaStore, which leaves the colons in keys readable.
 */
export function favoriteEntityId(kind: FavoriteKind, key: string) {
  return `${kind}:${encodeURIComponent(key).replaceAll("%3A", ":")}`;
}

/** Read the signed-in user's starred artists, albums and tracks. */
export async function getLibraryFavorites(): Promise<LibraryFavorites> {
  const r = await api.get<LibraryFavoritesWire>("/library/favorites");
  const starred = new Set([
    ...(r.data.artistIds ?? []),
    ...(r.data.albumIds ?? []),
    ...(r.data.songIds ?? []),
  ]);
  const library = r.data.library ?? {};
  const keep = (kind: FavoriteKind, identityKey?: string) =>
    !!identityKey && starred.has(favoriteEntityId(kind, identityKey));

  const artists = (library.artists ?? []).map(canonicalArtistToArtist);
  const artistsById = new Map(artists.map((artist) => [artist.id, artist]));
  const albums = (library.albums ?? []).map((item) => {
    const album = canonicalAlbumToAlbum(item);
    const artist = artistsById.get(album.artistId);
    return {
      ...album,
      artistName: artist?.artistName || album.artistName,
      artistMbid: artist?.mbid || undefined,
    };
  });
  const albumsById = new Map(albums.map((album) => [album.id, album]));

  // This route's rows carry no userFavorite, and every row kept here is one.
  return {
    artists: artists
      .filter((artist) => keep("artist", artist.identityKey))
      .map((artist) => ({ ...artist, userFavorite: true })),
    albums: albums
      .filter((album) => keep("album", album.identityKey))
      .map((album) => ({ ...album, userFavorite: true })),
    tracks: (library.tracks ?? [])
      .filter((item) => keep("song", item.identityKey))
      .map((item) => {
        const albumId = streamAlbumId(item);
        return {
          ...canonicalTrackToTrack(item, albumId),
          userFavorite: true,
          album: albumId ? albumsById.get(albumId) : undefined,
        };
      }),
    playlistSongIds: (r.data.playlistSongs ?? []).map((song) => song.id),
  };
}

/** Star or unstar entities. Build the ids with favoriteEntityId. */
export async function updateLibraryFavorites(ids: string[], starred: boolean) {
  const r = await api.post<{ changedIds: string[] }>("/library/favorites", {
    ids,
    starred,
  });
  return r.data;
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

/**
 * `mode=core` leaves out what pocket doesn't show: the artist's appearances on
 * other artists' releases, and each release's track count.
 */
export async function getArtistDetails(mbid: string, signal?: AbortSignal) {
  const r = await api.get<ArtistDetails>(`/artists/${mbid}`, {
    params: { mode: "core" },
    signal,
  });
  return r.data;
}

export async function getArtistCover(mbid: string) {
  const r = await api.get<CoverArtResponse>(`/artists/${mbid}/cover`);
  return r.data;
}

/**
 * What the server can search by when an album's MBID leads to no cover. It
 * remembers "no cover" for the MBID, so a lookup without these can hide a cover
 * that a later one with them would have found.
 */
export type AlbumCoverHints = {
  artistName?: string;
  albumTitle?: string;
};

export async function getAlbumCover(
  releaseGroupMbid: string,
  hints?: AlbumCoverHints,
) {
  const r = await api.get<CoverArtResponse>(
    `/artists/release-group/${releaseGroupMbid}/cover`,
    { params: hints },
  );
  return r.data;
}

export async function getDownloadStatuses(albumIds: string[]) {
  const r = await api.get<DownloadStatusMap>("/library/downloads/status", {
    params: { albumIds: albumIds.join(",") },
  });
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

export async function deleteLibraryArtist(mbid: string, deleteFiles = false) {
  const r = await api.delete(`/library/artists/${mbid}`, {
    params: { deleteFiles },
  });
  return r.data;
}

// The album routes below take a Library album id (Album.canonicalId), and
// answer 409 album_owner_conflict for an album Aurral does not manage.

/** Only the keys pocket reads are declared. */
export type AurralMonitoringResponse = {
  albumStatus?: RequestedAlbumStatus | null;
};

/** Monitoring an album queues its missing tracks; unmonitoring cancels them. */
export async function setAurralAlbumMonitored(
  albumId: string,
  monitored: boolean,
) {
  const r = await api.put<AurralMonitoringResponse>(
    `/library/albums/${albumId}`,
    { monitored },
  );
  return r.data;
}

/**
 * Without its files, a deleted album comes back on the next full scan. Either
 * way Aurral stops monitoring the release, so it is not downloaded again.
 */
export async function deleteAurralAlbum(albumId: string, deleteFiles: boolean) {
  const r = await api.delete<{ success: boolean; excluded: boolean }>(
    `/library/albums/${albumId}`,
    { params: { deleteFiles } },
  );
  return r.data;
}

export async function cancelAurralAlbum(albumId: string) {
  const r = await api.post<{ cancelledJobIds: string[] }>(
    `/library/albums/${albumId}/cancel`,
  );
  return r.data;
}

/** Re-searches the way the web does. */
export async function researchAurralAlbum(
  album: Pick<Album, "monitored" | "mbid" | "title"> & { canonicalId: string },
  artist: { mbid: string; name: string },
) {
  if (!album.monitored) {
    const updated = await setAurralAlbumMonitored(album.canonicalId, true);
    return updated.albumStatus ?? null;
  }
  const requested = await requestAlbumFromSearch({
    albumMbid: album.mbid,
    albumName: album.title,
    artistMbid: artist.mbid,
    artistName: artist.name,
  });
  return requested.albumStatus ?? null;
}

/** One track of a release group's edition, from its `tracks` route. */
export type ReleaseGroupTrack = {
  /** The recording's MBID, which `previews` keys clips by. */
  id: string;
  title: string;
  trackNumber: number;
  discNumber: number;
  /** MusicBrainz's name for the disc, when it has one. */
  discTitle?: string | null;
  length: number | null;
};

/**
 * The tracks of one edition of a release group. With no `release`, the server
 * picks the Library album's edition, else the standard one.
 */
export async function getReleaseGroupTracks(mbid: string, release?: string) {
  const r = await api.get<ReleaseGroupTrack[]>(
    `/artists/release-group/${mbid}/tracks`,
    { params: release ? { release } : undefined },
  );
  return r.data;
}

/** A thirty-second clip. The URL is a server path that needs no token. */
export type ReleaseGroupPreview = { preview_url: string };

/**
 * Clips for an edition's tracks, keyed by recording MBID. The server matches
 * them on Deezer, so a track it can't find there has none.
 */
export async function getReleaseGroupPreviews(
  mbid: string,
  params: { release?: string; artistMbid?: string } = {},
) {
  const query: Record<string, string> = {};
  if (params.release) query.release = params.release;
  if (params.artistMbid) query.artistMbid = params.artistMbid;
  const r = await api.get<{ previews: Record<string, ReleaseGroupPreview> }>(
    `/artists/release-group/${mbid}/previews`,
    { params: Object.keys(query).length > 0 ? query : undefined },
  );
  return r.data.previews;
}

/**
 * One edition of a release group: a tracklist its releases list in full.
 * Pressings with the same running order are one edition.
 */
export type AlbumEdition = {
  /** The release that stands for the edition. */
  id: string;
  /** "Standard" for the standard edition. Other names can repeat. */
  name: string;
  date: string | null;
  trackCount: number;
};

export type AlbumEditions = {
  /** The standard edition first, then the rest by date. */
  editions: AlbumEdition[];
  /** The edition the Library album lists. Null when it isn't in the Library. */
  library: string | null;
};

export async function getAlbumEditions(releaseGroupMbid: string) {
  const r = await api.get<AlbumEditions>(
    `/artists/release-group/${releaseGroupMbid}/editions`,
  );
  return r.data;
}

/**
 * Make an edition the Library album's. Its tracks without a file that the
 * edition doesn't list leave the album. Tracks with a file stay.
 */
export async function setAlbumEdition(albumId: string, releaseMbid: string) {
  await api.put(`/library/albums/${albumId}/edition`, { releaseMbid });
}

/** Only an album Aurral manages answers a request with one. */
export type RequestedAlbumStatus = {
  status: AurralAlbumStatus;
  releaseDate: string | null;
};

/** POST /library/albums. Only the keys pocket reads are declared. */
export type AddAlbumResponse = {
  albumStatus?: RequestedAlbumStatus | null;
};

export async function addLibraryAlbum(
  artistId: string,
  releaseGroupMbid: string,
  albumName: string,
) {
  const r = await api.post<AddAlbumResponse>("/library/albums", {
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
  /** An edition's release. Without it, Aurral picks the standard edition. */
  releaseMbid?: string;
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
  status: "available" | "searching" | "inLibrary" | "queued" | "blocked";
  queued: boolean;
  albumStatus?: RequestedAlbumStatus | null;
};

export async function requestAlbumFromSearch(payload: RequestAlbumPayload) {
  const r = await api.post<RequestAlbumResponse>(
    "/library/albums/request",
    payload,
  );
  return r.data;
}
