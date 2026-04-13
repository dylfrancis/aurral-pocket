import axios from "axios";
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

export async function getReleaseGroupTracks(
  mbid: string,
  deezerAlbumId?: string,
) {
  const r = await api.get<ReleaseGroupTrack[]>(
    `/artists/release-group/${mbid}/tracks`,
    {
      params: deezerAlbumId ? { deezerAlbumId } : undefined,
    },
  );
  return r.data;
}

export async function searchDeezerAlbum(
  artistName: string,
  albumTitle: string,
): Promise<string | null> {
  try {
    const { data } = await axios.get<{
      data?: { id: number; title: string }[];
    }>("https://api.deezer.com/search/album", {
      params: { q: `${artistName} ${albumTitle}`, limit: 5 },
      timeout: 10_000,
    });
    const lowerTitle = albumTitle.toLowerCase();
    const match =
      data.data?.find((a) => a.title.toLowerCase() === lowerTitle) ??
      data.data?.find(
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
