import { buildAuthenticatedUrl } from "@/lib/api/client";
import { getFlowArtworkPath, getFlowStreamPath } from "@/lib/api/flow";
import type { FlowJob } from "@/lib/types/flow";
import type { Track } from "@/lib/types/library";

/**
 * One sound as the audio engine takes it.
 *
 * The shape matches the engine's own track type, but it is declared here so
 * that lib/player/player.ts stays the only module that imports the engine.
 */
export type PlayerClip = {
  id: string;
  title: string;
  artist: string;
  album: string;
  /** Seconds. Zero means the engine reads the real length from the stream. */
  duration: number;
  url: string;
  artwork: string | null;
};

/**
 * A queued track: a clip plus the path its URL was built from, plus the ids a
 * play event carries. The saved queue keeps the path, because the URL's
 * session token does not last. A preview clip has no path and is never
 * restored.
 *
 * The MusicBrainz ids ride on the track rather than being read from the queue
 * when a play is reported. A track finishes as the next one starts, and the
 * queue can be replaced in the same moment; the track that finished still
 * carries its own ids.
 */
export type PlayerTrack = PlayerClip & {
  streamPath: string | null;
  /** The album's cover on the server. Tried before `artwork`. */
  coverPath: string | null;
  trackMbid: string | null;
  artistMbid: string | null;
  albumMbid: string | null;
  /** The key the favorites API addresses this track by. */
  identityKey: string | null;
  recordHistory?: boolean;
};

/** The album a track is played from. The engine shows this on the lock screen. */
export type PlayerAlbumContext = {
  albumTitle: string;
  artistName: string;
  /** An album's `coverUrl`. Tried before `artworkUrl`. */
  coverPath: string | null;
  /** The MBID lookup's image, for a server with no cover to give. */
  artworkUrl: string | null;
  /** The engine never sees this. Play events carry it. */
  albumMbid: string | null;
  /**
   * The engine never sees this. The now-playing screen uses it to open the
   * artist page.
   */
  artistMbid: string | null;
};

/**
 * Turn a library track into a playable one. Returns null — meaning "do not
 * start playback", not an error — when the track has no streamPath (Aurral
 * cannot read a file for it, even if Lidarr has one and the row shows a
 * checkmark) or when the session token is gone.
 */
export function toPlayerTrack(
  track: Track,
  album: PlayerAlbumContext,
): PlayerTrack | null {
  if (!track.streamPath) return null;

  const url = buildAuthenticatedUrl(track.streamPath);
  if (!url) return null;

  return {
    id: String(track.id),
    title: track.trackName,
    artist: album.artistName || "Unknown Artist",
    album: album.albumTitle || "Unknown Album",
    duration: 0,
    url,
    artwork: album.artworkUrl || null,
    streamPath: track.streamPath,
    coverPath: album.coverPath || null,
    trackMbid: track.mbid || null,
    artistMbid: album.artistMbid,
    albumMbid: album.albumMbid,
    identityKey: track.identityKey ?? null,
  };
}

export type PlaybackCollection = {
  id: string;
  name: string;
  artworkRevision?: number;
  recordHistory?: boolean;
};

export function jobToPlayerTrack(
  job: FlowJob,
  collection: PlaybackCollection,
): PlayerTrack | null {
  if (job.status !== "done") return null;

  const streamPath = getFlowStreamPath(job.id);
  const url = buildAuthenticatedUrl(streamPath);
  if (!url) return null;

  return {
    id: job.id,
    title: job.trackName,
    artist: job.artistName,
    // Empty rather than the collection's name, which a play event would then
    // report as the album.
    album: job.albumName ?? "",
    duration: 0,
    url,
    artwork: null,
    streamPath,
    coverPath: getFlowArtworkPath(collection.id, collection.artworkRevision),
    trackMbid: job.trackMbid,
    artistMbid: job.artistMbid,
    albumMbid: job.albumMbid,
    identityKey: null,
    recordHistory: collection.recordHistory,
  };
}

export function collectionPlayerContext(
  collection: PlaybackCollection,
): PlayerAlbumContext {
  return {
    albumTitle: collection.name,
    artistName: "",
    coverPath: getFlowArtworkPath(collection.id, collection.artworkRevision),
    artworkUrl: null,
    albumMbid: null,
    artistMbid: null,
  };
}
