import { api } from './client';
import type { Artist, Album, Track, CoverArtResponse } from '@/lib/types/library';

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

export function getArtistCover(mbid: string) {
  return api.get<CoverArtResponse>(`/artists/${mbid}/cover`).then((r) => r.data);
}

export function getAlbumCover(releaseGroupMbid: string) {
  return api
    .get<CoverArtResponse>(`/artists/release-group/${releaseGroupMbid}/cover`)
    .then((r) => r.data);
}
