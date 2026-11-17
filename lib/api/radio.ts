import { api } from "./client";
import type { LibraryQueueTrack } from "@/lib/types/library";

/** An artist seed. Any one field is enough for Aurral to find the artist. */
export type RadioArtist = {
  /** The Library artist id. */
  id?: string | null;
  mbid?: string | null;
  name?: string | null;
};

/**
 * What a station is built from. Ids are Library ids, as strings: the route
 * refuses numbers.
 */
export type RadioSeed = {
  trackIds?: string[];
  albumIds?: string[];
  artists?: RadioArtist[];
};

/**
 * The next batch of a station. Aurral leaves out the `exclude` track ids and
 * the seed tracks themselves.
 */
export async function getLibraryRadio(
  seed: RadioSeed,
  exclude: string[] = [],
): Promise<LibraryQueueTrack[]> {
  const r = await api.post<{ tracks?: LibraryQueueTrack[] }>("/library/radio", {
    ...seed,
    exclude,
  });
  return r.data.tracks ?? [];
}
