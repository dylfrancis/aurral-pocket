import { api } from "./client";
import type { LibraryQueueTrack } from "@/lib/types/library";

/**
 * A track of the server's play queue. A Library track comes in the shape radio
 * returns; a playlist job has no Library ids and no artwork.
 */
export type PlayQueueTrack = Omit<
  LibraryQueueTrack,
  "libraryTrackId" | "libraryAlbumId" | "libraryArtistId" | "artworkSource"
> & {
  libraryTrackId: number | null;
  libraryAlbumId: number | null;
  libraryArtistId: number | null;
  artworkSource: LibraryQueueTrack["artworkSource"] | null;
};

/** The queue the account last saved, from any client. */
export type PlayQueue = {
  /** When it was saved, in the server's epoch ms. */
  changed: number;
  /** The device or Subsonic client that saved it. */
  changedBy: string;
  /** Only the tracks that still play. */
  tracks: PlayQueueTrack[];
  currentIndex: number;
  positionMs: number;
};

export type PlayQueueSave = {
  /** `/library/stream/…` and `/playlists/stream/…` paths. Anything else is dropped. */
  streamPaths: string[];
  current: number;
  positionMs: number;
  device: string;
};

export async function getPlayQueue(): Promise<PlayQueue | null> {
  const r = await api.get<{ queue: PlayQueue | null }>("/play-queue");
  return r.data.queue ?? null;
}

/**
 * Returns when the server saved it, or null when it saved nothing because the
 * current track is in neither the Library nor a playlist.
 */
export async function savePlayQueue(
  save: PlayQueueSave,
): Promise<number | null> {
  const r = await api.put<{ changed: number | null }>("/play-queue", save);
  return r.data.changed ?? null;
}
