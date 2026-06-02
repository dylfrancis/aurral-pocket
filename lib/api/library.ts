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
} from "@/lib/types/library";

type ArtistDetailsResponse = {
  tags?: ArtistTag[];
  bio?: string;
  "release-groups"?: ReleaseGroup[];
};

export async function getLibraryArtists() {
  const r = await api.get<Artist[]>("/library/artists");
  return r.data;
}

export async function getLibraryArtist(mbid: string) {
  const r = await api.get<Artist>(`/library/artists/${mbid}`);
  return r.data;
}

export async function getLibraryAlbums(artistId: string) {
  const r = await api.get<Album[]>("/library/albums", { params: { artistId } });
  return r.data;
}

export async function getLibraryTracks(albumId: string) {
  const r = await api.get<Track[]>("/library/tracks", { params: { albumId } });
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
