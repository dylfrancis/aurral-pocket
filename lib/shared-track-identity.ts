import type { SharedPlaylistTrack } from "@/lib/types/flow";

/**
 * Mirror of Aurral's `buildSharedTrackIdentity`
 * (backend/services/weeklyFlow/weeklyFlowPlaylistConfig.js). The server uses
 * this key to skip duplicate tracks on append, and the status snapshot
 * exposes each shared playlist's keys as `trackIdentities`. Computing the
 * same key here lets the app tell, before an append, whether the server
 * would treat the track as already present.
 *
 * The two implementations must stay in sync — a drift here only degrades to
 * a missing or wrong "Already added" mark, never to a wrong append, because
 * the server filters duplicates itself.
 */
export function buildSharedTrackIdentity(track: SharedPlaylistTrack): string {
  return [
    String(track.artistName || "")
      .trim()
      .toLowerCase(),
    String(track.trackName || "")
      .trim()
      .toLowerCase(),
    String(track.albumName || "")
      .trim()
      .toLowerCase(),
    String(track.artistMbid || "").trim(),
    String(track.albumMbid || "").trim(),
    String(track.trackMbid || "").trim(),
    String(track.releaseYear || "").trim(),
  ].join("\u0001");
}
