import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import type {
  TrackMenuAction,
  TrackMenuActionId,
} from "@/components/player/track-menu-types";
import {
  albumCoverQuery,
  coverArtUrlFrom,
} from "@/hooks/library/use-cover-art-url";
import { albumCoverHints, needsAlbumCover } from "@/hooks/player/queue-covers";
import {
  rememberSongCovers,
  removeSaved,
  retrySaved,
  saveSong,
  useTrackSaves,
} from "@/lib/offline/saved-library";
import type { PlayerTrack } from "@/lib/player/track-item";

/**
 * Save Offline for one song, in any song's menu. A song that's on the phone
 * only as part of a saved album or playlist says so and can't be removed on
 * its own: it goes with that save.
 */
export function useSongSave() {
  const saveOf = useTrackSaves();
  const queryClient = useQueryClient();

  /** Null for a track with no file to save, such as a preview clip. */
  const actionFor = useCallback(
    (track: PlayerTrack | null): TrackMenuAction | null => {
      if (!track?.streamPath) return null;
      const save = saveOf(track.id);
      if (save.kind === "none") {
        return { id: "save-offline", title: "Save Offline" };
      }
      if (save.kind === "held") {
        return {
          id: "saved-with",
          title: save.by ? `Saved with “${save.by}”` : "Saved Offline",
          disabled: true,
        };
      }
      if (save.state === "saved") {
        return { id: "remove-offline", title: "Remove from Phone" };
      }
      if (save.state === "incomplete") {
        return { id: "save-offline", title: "Try Saving Again" };
      }
      return { id: "remove-offline", title: "Stop Saving" };
    },
    [saveOf],
  );

  /** Runs a song-save action. False for any other action. */
  const run = useCallback(
    (id: TrackMenuActionId, track: PlayerTrack): boolean => {
      if (id === "save-offline") {
        if (saveOf(track.id).kind === "own") {
          retrySaved("song", track.id);
        } else {
          saveSong(track);
          rememberCover(queryClient, track).catch(() => {});
        }
        Burnt.toast({ title: "Saving offline", preset: "done" });
        return true;
      }
      if (id === "remove-offline") {
        void removeSaved("song", track.id);
        Burnt.toast({ title: "Removed from phone", preset: "done" });
        return true;
      }
      return id === "saved-with";
    },
    [saveOf, queryClient],
  );

  return { actionFor, run };
}

/**
 * A playlist or flow track brings no cover; its page looks one up by album
 * while it plays. The save goes ahead, and takes the cover once it's found.
 */
async function rememberCover(queryClient: QueryClient, track: PlayerTrack) {
  if (!needsAlbumCover(track)) return;
  const mbid = track.albumMbid!;
  const cover = await queryClient
    .fetchQuery(albumCoverQuery(mbid, albumCoverHints(track)))
    .catch(() => undefined);
  const url = coverArtUrlFrom(cover);
  if (url) rememberSongCovers(new Map([[mbid, url]]));
}
