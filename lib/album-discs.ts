/** Where a track sits on an album: its disc, and its number on that disc. */
type DiscPosition = {
  discNumber?: number | null;
  trackNumber?: number | null;
};

/** Disc 1 when nothing says otherwise, as on the web. */
export function discOf(track: { discNumber?: number | null }) {
  return track.discNumber && track.discNumber > 0 ? track.discNumber : 1;
}

// An unnumbered track ends its disc.
const numberOf = (track: DiscPosition) =>
  track.trackNumber && track.trackNumber > 0
    ? track.trackNumber
    : Number.MAX_SAFE_INTEGER;

/** Disc, then track number. Tracks at the same place keep their order. */
export function sortByDisc<T extends DiscPosition>(tracks: readonly T[]): T[] {
  return [...tracks].sort(
    (a, b) => discOf(a) - discOf(b) || numberOf(a) - numberOf(b),
  );
}

/** Each disc's title. A disc whose tracks name it differently gets none. */
export function discTitles(
  tracks: Iterable<{ disc: number; title?: string | null }>,
) {
  const seen = new Map<number, Set<string>>();
  for (const { disc, title } of tracks) {
    if (title) seen.set(disc, (seen.get(disc) ?? new Set()).add(title));
  }
  const titles = new Map<number, string>();
  for (const [disc, names] of seen) {
    if (names.size === 1) titles.set(disc, [...names][0]);
  }
  return titles;
}

export type DiscRow = {
  disc: number;
  tagTitle?: string | null;
  musicBrainzTitle?: string | null;
};

/**
 * The heading above each row of a list in disc order, or null; a one-disc album
 * gets none. A file's disc subtitle tag wins over MusicBrainz's, as on the web.
 */
export function discHeadings(rows: readonly DiscRow[]): (string | null)[] {
  if (new Set(rows.map((row) => row.disc)).size < 2) {
    return rows.map(() => null);
  }
  const tagTitles = discTitles(
    rows.map((row) => ({ disc: row.disc, title: row.tagTitle })),
  );
  const musicBrainzTitles = discTitles(
    rows.map((row) => ({ disc: row.disc, title: row.musicBrainzTitle })),
  );
  return rows.map(({ disc }, index) => {
    if (index > 0 && rows[index - 1].disc === disc) return null;
    const title = tagTitles.get(disc) ?? musicBrainzTitles.get(disc);
    return title ? `Disc ${disc} · ${title}` : `Disc ${disc}`;
  });
}
