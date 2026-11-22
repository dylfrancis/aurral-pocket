import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import { songsOfPages } from "@/hooks/library/use-song-list";
import {
  useStartQueue,
  type StartQueueOptions,
} from "@/hooks/player/use-start-queue";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import {
  toPlayerTrack,
  type PlayerAlbumContext,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type {
  AlbumTrack,
  CanonicalPage,
  LibrarySort,
} from "@/lib/types/library";

/** The server's page cap. */
const PAGE_SIZE = 100;

/** Up to 500 songs a play, so even a large Library starts in a moment. */
const PLAY_PAGES = 5;

export type SongFilter = {
  genre?: string;
  favorite?: boolean;
  artistId?: string;
};

function readSongPage(
  filter: SongFilter,
  page: number,
  sort?: LibrarySort,
): Promise<CanonicalPage> {
  return getCanonicalLibraryPage({
    kind: "tracks",
    source: "all",
    // Songs with no file can't play.
    availableOnly: true,
    page,
    pageSize: PAGE_SIZE,
    genre: filter.genre,
    favorite: filter.favorite,
    artistId: filter.artistId,
    sort,
    direction: sort ? "asc" : undefined,
  });
}

/** `count` distinct page numbers drawn at random from 1 to `pageCount`. */
export function randomPages(pageCount: number, count: number): number[] {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  for (let i = 0; i < Math.min(count, pages.length); i++) {
    const j = i + Math.floor(Math.random() * (pages.length - i));
    [pages[i], pages[j]] = [pages[j], pages[i]];
  }
  return pages.slice(0, count);
}

/**
 * The server can't shuffle songs, so page 1 gives the count and five random
 * pages follow; title order makes each page span many artists and albums.
 */
export async function readShuffleSongs(
  filter: SongFilter,
): Promise<AlbumTrack[]> {
  const first = await readSongPage(filter, 1);
  const pageCount = Math.ceil(first.total / PAGE_SIZE);
  const pages = await Promise.all(
    randomPages(pageCount, PLAY_PAGES).map((page) =>
      page === 1 ? first : readSongPage(filter, page),
    ),
  );
  return songsOfPages(pages);
}

/** The first songs of the filter in `sort` order, up to five pages' worth. */
export async function readFirstSongs(
  filter: SongFilter,
  sort: LibrarySort,
): Promise<AlbumTrack[]> {
  const pages: CanonicalPage[] = [];
  for (let page = 1; page <= PLAY_PAGES; page++) {
    const result = await readSongPage(filter, page, sort);
    pages.push(result);
    if (!result.hasMore) break;
  }
  return songsOfPages(pages);
}

function compareAlbumOrder(a: AlbumTrack, b: AlbumTrack) {
  return (
    (a.album?.releaseDate ?? "").localeCompare(b.album?.releaseDate ?? "") ||
    (a.album?.albumName ?? "").localeCompare(b.album?.albumName ?? "") ||
    (a.discNumber ?? 1) - (b.discNumber ?? 1) ||
    a.trackNumber - b.trackNumber
  );
}

/**
 * Every playable song of one Library artist, in the artist queue's order. The
 * queue route takes only an MBID.
 */
export async function readArtistSongs(
  libraryArtistId: string,
): Promise<AlbumTrack[]> {
  const pages: CanonicalPage[] = [];
  for (let page = 1; ; page++) {
    const result = await readSongPage({ artistId: libraryArtistId }, page);
    pages.push(result);
    if (!result.hasMore || page * PAGE_SIZE >= result.total) break;
  }
  return songsOfPages(pages).sort(compareAlbumOrder);
}

/** `isLoading` is true while a read is on its way; a second tap meanwhile does nothing. */
export function usePlayLibrarySongs() {
  const queryClient = useQueryClient();
  const startQueue = useStartQueue();
  const [isLoading, setIsLoading] = useState(false);
  const reading = useRef(false);

  // Built at the tap: each URL carries the session token.
  const playSongs = useCallback(
    (
      songs: readonly AlbumTrack[],
      context: PlayerAlbumContext,
      options?: StartQueueOptions,
    ) => {
      const items = songs
        .map((song) =>
          toPlayerTrack(song, albumTrackContext(song, queryClient)),
        )
        .filter((item): item is PlayerTrack => item !== null);
      return startQueue(items, context, options);
    },
    [queryClient, startQueue],
  );

  const readAndPlay = useCallback(
    async (
      read: () => Promise<AlbumTrack[]>,
      context: PlayerAlbumContext,
      options?: StartQueueOptions,
    ) => {
      if (reading.current) return false;
      reading.current = true;
      setIsLoading(true);
      try {
        return await playSongs(await read(), context, options);
      } catch (error) {
        Burnt.toast({
          title: "Couldn't load songs",
          message: error instanceof Error ? error.message : undefined,
          preset: "error",
        });
        return false;
      } finally {
        reading.current = false;
        setIsLoading(false);
      }
    },
    [playSongs],
  );

  return { playSongs, readAndPlay, isLoading };
}

/** A queue of songs from many albums, named for where it was started. */
export function songListContext(title: string): PlayerAlbumContext {
  return {
    albumTitle: title,
    artistName: "",
    coverPath: null,
    artworkUrl: null,
    albumMbid: null,
    artistMbid: null,
  };
}
