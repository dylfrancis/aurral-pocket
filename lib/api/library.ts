import axios from 'axios';
import { api } from './client';
import type { Artist, Album, Track, CoverArtResponse, ReleaseGroup, ArtistTag, PreviewTrack } from '@/lib/types/library';

type ArtistDetailsResponse = {
  tags?: ArtistTag[];
  bio?: string;
};

export function getLibraryArtists() {
  return api.get<Artist[]>('/library/artists').then((r) => r.data);
}

export function getLibraryArtist(mbid: string) {
  return api.get<Artist>(`/library/artists/${mbid}`).then((r) => r.data);
}

export function getLibraryAlbums(artistId: string) {
  return api.get<Album[]>('/library/albums', { params: { artistId } }).then((r) => r.data);
}

export function getLibraryTracks(albumId: string) {
  return api.get<Track[]>('/library/tracks', { params: { albumId } }).then((r) => r.data);
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

export function getArtistDetails(mbid: string) {
  return api
    .get<ArtistDetailsResponse>(`/artists/${mbid}`)
    .then((r) => ({ tags: r.data.tags ?? [], bio: r.data.bio ?? null }));
}

export function getArtistCover(mbid: string) {
  return api.get<CoverArtResponse>(`/artists/${mbid}/cover`).then((r) => r.data);
}

export function getAlbumCover(releaseGroupMbid: string) {
  return api
    .get<CoverArtResponse>(`/artists/release-group/${releaseGroupMbid}/cover`)
    .then((r) => r.data);
}

export function triggerAlbumSearch(albumId: string) {
  return api.post('/library/downloads/album/search', { albumId }).then((r) => r.data);
}

export function getArtistPreviewTracks(mbid: string, artistName?: string) {
  return api
    .get<{ tracks: PreviewTrack[] }>(`/artists/${mbid}/preview`, {
      params: artistName ? { artistName } : undefined,
    })
    .then((r) => r.data.tracks);
}

export function refreshLibraryArtist(mbid: string) {
  return api.post(`/library/artists/${mbid}/refresh`).then((r) => r.data);
}

export function deleteLibraryArtist(mbid: string, deleteFiles = false) {
  return api
    .delete(`/library/artists/${mbid}`, { params: { deleteFiles } })
    .then((r) => r.data);
}

export function deleteAlbum(albumId: string, deleteFiles = false) {
  return api.delete(`/library/albums/${albumId}`, { params: { deleteFiles } }).then((r) => r.data);
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

export function getReleaseGroupTracks(mbid: string, deezerAlbumId?: string) {
  return api
    .get<ReleaseGroupTrack[]>(`/artists/release-group/${mbid}/tracks`, {
      params: deezerAlbumId ? { deezerAlbumId } : undefined,
    })
    .then((r) => r.data);
}

export async function searchDeezerAlbum(artistName: string, albumTitle: string): Promise<string | null> {
  try {
    const { data } = await axios.get<{ data?: { id: number; title: string }[] }>(
      'https://api.deezer.com/search/album',
      { params: { q: `${artistName} ${albumTitle}`, limit: 5 }, timeout: 3000 },
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

export function addLibraryAlbum(artistId: string, releaseGroupMbid: string, albumName: string) {
  return api
    .post<Album>('/library/albums', { artistId, releaseGroupMbid, albumName })
    .then((r) => r.data);
}
