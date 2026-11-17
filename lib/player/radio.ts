import type { RadioArtist, RadioSeed } from "@/lib/api/radio";
import {
  libraryIdsOf,
  queueTrackToPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { LibraryQueueTrack } from "@/lib/types/library";

/** A queue started as radio keeps growing from its seed as it runs low. */
export type RadioStation = {
  seed: RadioSeed;
  /** What the station is named after: a track, album or artist. */
  label: string;
};

/** The web's cap. A long session's oldest tracks may come round again. */
const EXCLUDE_LIMIT = 500;

/**
 * Library tracks seed by their id; any other, such as a playlist job, by its
 * artist, once per artist.
 */
export function radioSeedFor(items: PlayerTrack[]): RadioSeed {
  const trackIds = new Set<string>();
  const artists = new Map<string, RadioArtist>();
  for (const item of items) {
    const ids = libraryIdsOf(item.streamPath);
    if (ids) trackIds.add(ids.libraryTrackId);
    else if (item.artist) {
      const key = item.artistMbid || item.artist.toLowerCase();
      if (!artists.has(key)) {
        artists.set(key, { mbid: item.artistMbid, name: item.artist });
      }
    }
  }
  return { trackIds: [...trackIds], artists: [...artists.values()] };
}

export function hasRadioSeed(seed: RadioSeed): boolean {
  return (
    !!seed.trackIds?.length || !!seed.albumIds?.length || !!seed.artists?.length
  );
}

/** The queued Library tracks a station's next batch must not repeat. */
export function radioExclude(items: PlayerTrack[]): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    const libraryTrackId = libraryIdsOf(item.streamPath)?.libraryTrackId;
    if (libraryTrackId) ids.add(libraryTrackId);
  }
  return [...ids].slice(-EXCLUDE_LIMIT);
}

/** Each track carries its own album, so the station's context names only it. */
export function radioContext(station: RadioStation): PlayerAlbumContext {
  return {
    albumTitle: `${station.label} Radio`,
    artistName: "",
    coverPath: null,
    artworkUrl: null,
    albumMbid: null,
    artistMbid: null,
  };
}

export function radioTracks(tracks: LibraryQueueTrack[]): PlayerTrack[] {
  return tracks
    .map((track) => queueTrackToPlayerTrack(track, null))
    .filter((item): item is PlayerTrack => item !== null);
}
