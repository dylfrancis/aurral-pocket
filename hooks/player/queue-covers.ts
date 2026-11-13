import type { QueryClient } from "@tanstack/react-query";
import {
  albumCoverQuery,
  coverArtUrlFrom,
} from "@/hooks/library/use-cover-art-url";
import type { AlbumCoverHints } from "@/lib/api/library";
import { setQueuedAlbumCovers } from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";
import { libraryKeys } from "@/lib/query-keys";
import type { CoverArtResponse } from "@/lib/types/library";

/**
 * Covers for tracks that bring none, such as playlist and flow tracks: the
 * server has no art for them, so the cover is looked up by album MBID, as the
 * web does.
 */

/** Every track in a big flow can be from a different album. */
const COVER_LOOKUPS_AT_ONCE = 6;

/** The cover a lookup already found, with no request. */
export function cachedAlbumCover(
  queryClient: QueryClient,
  albumMbid: string | null,
): string | null {
  if (!albumMbid) return null;
  return coverArtUrlFrom(
    queryClient.getQueryData<CoverArtResponse>(
      libraryKeys.albumCover(albumMbid),
    ),
  );
}

export function needsAlbumCover(item: PlayerTrack): boolean {
  return !!item.albumMbid && !item.artwork && !item.coverPath;
}

/**
 * The names go with every lookup: without them the server can record the
 * album as having no cover, which hides it from later lookups too.
 */
export function albumCoverHints(item: {
  artist: string;
  album: string;
}): AlbumCoverHints {
  return { artistName: item.artist, albumTitle: item.album || undefined };
}

/**
 * Look up the covers the queue's tracks lack and hand each to the player as
 * it arrives. Resolves with every cover found, by album MBID.
 */
export async function fillQueueCovers(
  queryClient: QueryClient,
  items: PlayerTrack[],
): Promise<Map<string, string>> {
  const albums = new Map<string, AlbumCoverHints>();
  for (const item of items) {
    if (needsAlbumCover(item)) {
      albums.set(item.albumMbid!, albumCoverHints(item));
    }
  }

  const all = new Map<string, string>();
  const pending = [...albums];
  for (let i = 0; i < pending.length; i += COVER_LOOKUPS_AT_ONCE) {
    const found = await Promise.all(
      pending
        .slice(i, i + COVER_LOOKUPS_AT_ONCE)
        .map(async ([mbid, hints]): Promise<[string, string | null]> => {
          const cover = await queryClient
            .fetchQuery(albumCoverQuery(mbid, hints))
            .catch(() => undefined);
          return [mbid, coverArtUrlFrom(cover)];
        }),
    );
    const covers = new Map(
      found.filter((entry): entry is [string, string] => entry[1] !== null),
    );
    covers.forEach((url, mbid) => all.set(mbid, url));
    if (covers.size > 0) await setQueuedAlbumCovers(covers).catch(() => {});
  }
  return all;
}
