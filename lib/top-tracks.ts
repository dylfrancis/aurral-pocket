import { absolutizeServerPath } from "@/lib/api/client";
import {
  queueTrackToPlayerTrack,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { LibraryQueueTrack, PreviewTrack } from "@/lib/types/library";

/** One of an artist's top tracks, with the Library's copy when it has one. */
export type TopTrack = {
  preview: PreviewTrack;
  library: LibraryQueueTrack | null;
};

/** Case, accents and punctuation never tell two titles apart. */
function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// "(Remastered 2009)", "[Live]" and " - 2011 Remaster" name a version of the
// same song.
const VERSION_SUFFIX =
  /\s+-\s+.*\b(remaster(ed)?|version|edit|mix|mono|stereo|live|single)\b.*$/i;

function loose(text: string): string {
  return normalize(
    text.replace(/\s*[([][^)\]]*[)\]]/g, " ").replace(VERSION_SUFFIX, ""),
  );
}

/**
 * Match each top track to the Library's copy. Deezer sends no MusicBrainz ids,
 * so titles decide: the same title first, then the same title without a
 * version note such as "(Remastered)". When several Library tracks share a
 * title, the one on the same album wins, else the earliest album, which the
 * queue lists first.
 */
export function matchTopTracks(
  previews: readonly PreviewTrack[],
  library: readonly LibraryQueueTrack[],
): TopTrack[] {
  const exact = groupBy(library, (track) => normalize(track.title));
  const byLoose = groupBy(library, (track) => loose(track.title));

  return previews.map((preview) => {
    const candidates =
      exact.get(normalize(preview.title)) ??
      byLoose.get(loose(preview.title)) ??
      [];
    const album = preview.album ? normalize(preview.album) : null;
    const match =
      (album && candidates.find((track) => normalize(track.album) === album)) ||
      candidates[0] ||
      null;
    return { preview, library: match };
  });
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/** A clip's queue id, kept apart from the Library's numeric track ids. */
export function topTrackClipId(preview: PreviewTrack): string {
  return `preview:${preview.id}`;
}

/**
 * The queue item for a top track: the Library's file when there is one, else
 * the thirty-second clip. Null for a Library track whose URL can't be built
 * now, as when the session has ended.
 */
export function topTrackItem(
  topTrack: TopTrack,
  artist: { name: string; mbid: string },
): PlayerTrack | null {
  if (topTrack.library) {
    return queueTrackToPlayerTrack(topTrack.library, null);
  }
  const { preview } = topTrack;
  return {
    id: topTrackClipId(preview),
    title: preview.title,
    artist: artist.name,
    album: preview.album ?? "",
    duration: 0,
    // The server sends Deezer clips as paths. They need no token.
    url: absolutizeServerPath(preview.preview_url),
    artwork: preview.artworkUrl ?? null,
    streamPath: null,
    coverPath: null,
    trackMbid: null,
    artistMbid: artist.mbid,
    albumMbid: null,
    favorite: null,
    isPreview: true,
  };
}
