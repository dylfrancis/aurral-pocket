import { discOf } from "@/lib/album-discs";
import type { AlbumEdition, ReleaseGroupTrack } from "@/lib/api/library";
import { releaseYear } from "@/lib/date-time";
import { formatTrackCount } from "@/lib/discover/format";
import type { Track } from "@/lib/types/library";

/** "Standard" reads as "Standard edition". A name that ends in edition stays. */
export function editionLabel(name: string) {
  return /\bedition$/i.test(name) ? name : `${name} edition`;
}

/** Names repeat, so the year and length tell editions apart. */
export function editionSubtitle(
  edition: AlbumEdition,
  libraryId: string | null,
) {
  return [
    releaseYear(edition.date),
    formatTrackCount(edition.trackCount),
    edition.id === libraryId ? "In Library" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** One track an edition lists, with the Library album's copy when it has one. */
export type EditionRow = {
  key: string;
  editionTrack: ReleaseGroupTrack;
  libraryTrack: Track | null;
};

const normalizeTitle = (title: string) =>
  title
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Matches an edition's tracks to the Library album's, by recording, then by
 * title at the same place. `extras` are Library files the edition doesn't
 * list, which a switch keeps.
 */
export function editionRows(
  editionTracks: readonly ReleaseGroupTrack[],
  libraryTracks: readonly Track[],
): { rows: EditionRow[]; extras: Track[] } {
  const unmatched = new Set(libraryTracks);
  const rows = editionTracks.map((editionTrack, index) => {
    const title = normalizeTitle(editionTrack.title);
    let libraryTrack =
      libraryTracks.find(
        (track) => track.mbid !== "" && track.mbid === editionTrack.id,
      ) ?? null;
    if (!libraryTrack || !unmatched.has(libraryTrack)) {
      libraryTrack =
        [...unmatched].find(
          (track) =>
            discOf(track) === discOf(editionTrack) &&
            track.trackNumber === editionTrack.trackNumber &&
            title !== "" &&
            normalizeTitle(track.title) === title,
        ) ?? null;
    }
    if (libraryTrack) unmatched.delete(libraryTrack);
    return {
      key: libraryTrack?.id ?? `${editionTrack.id}-${index}`,
      editionTrack,
      libraryTrack,
    };
  });
  return {
    rows,
    extras: libraryTracks.filter(
      (track) => unmatched.has(track) && !!track.streamPath,
    ),
  };
}
