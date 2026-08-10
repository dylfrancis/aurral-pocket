import type {
  BlockedArtist,
  DiscoveryFeedbackEntry,
} from "@/lib/types/discovery-feedback";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidMbid(value: string | null | undefined): boolean {
  return !!value && UUID_REGEX.test(value.trim());
}

/**
 * Aurral keeps expired feedback rows in the table and filters them on read, so
 * Pocket has to apply the same rule or it will show blocks the server no longer
 * honours. A missing or unparseable expiresAt means "never expires".
 */
function isExpired(entry: DiscoveryFeedbackEntry, now: number): boolean {
  if (!entry.expiresAt) return false;
  const expiry = new Date(entry.expiresAt).getTime();
  return Number.isFinite(expiry) ? expiry <= now : false;
}

/**
 * Narrows the feedback list to blocked artists. Entries without an `id` are
 * dropped: unblocking is DELETE /discover/feedback/:id, so a row we cannot
 * address would render an un-removable chip.
 */
export function selectBlockedArtists(
  entries: DiscoveryFeedbackEntry[] | undefined,
  now: number = Date.now(),
): BlockedArtist[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const blocked: BlockedArtist[] = [];

  for (const entry of entries) {
    if (entry?.action !== "block_artist") continue;
    if (!entry.id) continue;
    if (isExpired(entry, now)) continue;

    const name = (entry.artistName ?? "").trim();
    const artistId = (entry.artistId ?? "").trim() || null;
    if (!name && !artistId) continue;

    const key = (artistId || name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    blocked.push({ id: entry.id, artistId, name: name || artistId! });
  }

  return blocked.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/**
 * Matches Aurral's own comparison, which keys on either id or name so an artist
 * blocked by name still suppresses a recommendation that carries an id.
 */
export function isArtistBlocked(
  blocked: BlockedArtist[],
  artist: { id?: string | null; name?: string | null },
): boolean {
  const id = (artist.id ?? "").trim().toLowerCase();
  const name = (artist.name ?? "").trim().toLowerCase();
  if (!id && !name) return false;

  return blocked.some((entry) => {
    const entryId = (entry.artistId ?? "").trim().toLowerCase();
    const entryName = entry.name.trim().toLowerCase();
    if (id && entryId && id === entryId) return true;
    return !!name && !!entryName && name === entryName;
  });
}
