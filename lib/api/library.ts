import axios from 'axios';
import { api } from './client';
import type { Artist, Album, Track, CoverArtResponse, ReleaseGroup, ArtistTag, PreviewTrack, DownloadStatusMap } from '@/lib/types/library';

type ArtistDetailsResponse = {
  tags?: ArtistTag[];
  bio?: string;
};

export async function getLibraryArtists() {
  const r = await api.get<Artist[]>('/library/artists');
  return r.data;
}

export async function getLibraryArtist(mbid: string) {
  const r = await api.get<Artist>(`/library/artists/${mbid}`);
  return r.data;
}

export async function getLibraryAlbums(artistId: string) {
  const r = await api.get<Album[]>('/library/albums', {params: {artistId}});
  return r.data;
}

export async function getLibraryTracks(albumId: string) {
  const r = await api.get<Track[]>('/library/tracks', {params: {albumId}});
  return r.data;
}

export async function getArtistReleaseGroups(mbid: string): Promise<ReleaseGroup[]> {
  const allGroups: ReleaseGroup[] = [];
  let offset = 0;
  const limit = 100;

  // MusicBrainz paginates — fetch all release groups for this artist
  const MAX_PAGES = 50;
  while (offset / limit < MAX_PAGES) {
    const { data } = await axios.get<{ 'release-groups': ReleaseGroup[] }>(
      `https://musicbrainz.org/ws/2/release-group`,
      {
        params: {
          artist: mbid,
          'type': 'album|ep|single',
          fmt: 'json',
          limit,
          offset,
        },
        headers: { 'User-Agent': 'AurralPocket/1.0 (https://github.com/lklynet/aurral)' },
        timeout: 10_000,
      },
    );

    const groups = data['release-groups'];
    allGroups.push(...groups);
    if (groups.length < limit) break;
    offset += limit;
  }

  return allGroups;
}

export async function getArtistDetails(mbid: string) {
  const r = await api
      .get<ArtistDetailsResponse>(`/artists/${mbid}`);
  return ({tags: r.data.tags ?? [], bio: r.data.bio ?? null});
}

export async function getArtistCover(mbid: string) {
  const r = await api.get<CoverArtResponse>(`/artists/${mbid}/cover`);
  return r.data;
}

export async function getAlbumCover(releaseGroupMbid: string) {
  const r = await api
      .get<CoverArtResponse>(`/artists/release-group/${releaseGroupMbid}/cover`);
  return r.data;
}

export async function getDownloadStatuses(albumIds: string[]) {
  let r = await api
      .get<DownloadStatusMap>('/library/downloads/status', {
        params: {albumIds: albumIds.join(',')},
      });
  return r.data;
}

export async function triggerAlbumSearch(albumId: string) {
  const r = await api.post('/library/downloads/album/search', {albumId});
  return r.data;
}

export async function getArtistPreviewTracks(mbid: string, artistName?: string) {
  const r = await api
      .get<{ tracks: PreviewTrack[]; }>(`/artists/${mbid}/preview`, {
        params: artistName ? {artistName} : undefined,
      });
  return r.data.tracks;
}

export async function refreshLibraryArtist(mbid: string) {
  const r = await api.post(`/library/artists/${mbid}/refresh`);
  return r.data;
}

export async function deleteLibraryArtist(mbid: string, deleteFiles = false) {
  const r = await api
      .delete(`/library/artists/${mbid}`, {params: {deleteFiles}});
  return r.data;
}

export async function deleteAlbum(albumId: string, deleteFiles = false) {
  const r = await api.delete(`/library/albums/${albumId}`, {params: {deleteFiles}});
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

export async function getReleaseGroupTracks(mbid: string, deezerAlbumId?: string) {
  const r = await api
      .get<ReleaseGroupTrack[]>(`/artists/release-group/${mbid}/tracks`, {
        params: deezerAlbumId ? {deezerAlbumId} : undefined,
      });
  return r.data;
}

export async function searchDeezerAlbum(artistName: string, albumTitle: string): Promise<string | null> {
  try {
    const { data } = await axios.get<{ data?: { id: number; title: string }[] }>(
      'https://api.deezer.com/search/album',
      { params: { q: `${artistName} ${albumTitle}`, limit: 5 }, timeout: 5000 },
    );
    const lowerTitle = albumTitle.toLowerCase();
    const match = data.data?.find(
      (a) => a.title.toLowerCase() === lowerTitle,
    ) ?? data.data?.find(
      (a) => a.title.toLowerCase().includes(lowerTitle) || lowerTitle.includes(a.title.toLowerCase()),
    );
    return match ? `dz-${match.id}` : null;
  } catch {
    return null;
  }
}

export async function addLibraryAlbum(artistId: string, releaseGroupMbid: string, albumName: string) {
  const r = await api
      .post<Album>('/library/albums', {artistId, releaseGroupMbid, albumName});
  return r.data;
}
