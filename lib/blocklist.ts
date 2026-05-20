import type { BlockedArtist, Blocklist } from "@/lib/types/discover";

const MBID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidMbid(value: string | null | undefined): boolean {
  return !!value && MBID_REGEX.test(value.trim());
}

function normalizeMbid(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return MBID_REGEX.test(trimmed) ? trimmed.toLowerCase() : null;
}

function normalizeName(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeArtists(
  artists: Partial<BlockedArtist>[] | null | undefined,
): BlockedArtist[] {
  const list = Array.isArray(artists) ? artists : [];
  const seen = new Set<string>();
  const out: BlockedArtist[] = [];
  for (const entry of list) {
    if (!entry) continue;
    const mbid = normalizeMbid(entry.mbid ?? null);
    const name = normalizeName(entry.name ?? null);
    if (!mbid && !name) continue;
    const key = mbid ? `mbid:${mbid}` : `name:${name!.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ mbid, name });
  }
  return out;
}

export function normalizeTags(
  tags: (string | null | undefined)[] | null | undefined,
): string[] {
  const list = Array.isArray(tags) ? tags : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of list) {
    const normalized = String(entry || "")
      .trim()
      .toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function normalizeBlocklist(
  value: Partial<Blocklist> | null | undefined,
): Blocklist {
  return {
    artists: normalizeArtists(value?.artists),
    tags: normalizeTags(value?.tags),
  };
}

/**
 * Returns true if the given artist (identified by mbid + name) is already
 * present in the blocklist. mbid match wins; falls back to case-insensitive
 * name match for legacy entries created without an mbid (e.g. on web).
 */
export function isArtistBlocked(
  mbid: string | null | undefined,
  name: string | null | undefined,
  blocklist: Blocklist | null | undefined,
): boolean {
  if (!blocklist) return false;
  const candidateMbid = normalizeMbid(mbid);
  const candidateName = name?.trim().toLowerCase() ?? "";
  for (const entry of blocklist.artists) {
    const entryMbid = entry.mbid?.toLowerCase() ?? null;
    const entryName = entry.name?.trim().toLowerCase() ?? "";
    if (candidateMbid && entryMbid && candidateMbid === entryMbid) return true;
    if (!candidateMbid && candidateName && entryName === candidateName)
      return true;
  }
  return false;
}

/**
 * Returns a blocklist with the artist toggled on/off. If already present
 * (mbid match preferred, name fallback), it's removed; otherwise added.
 */
export function toggleArtistInBlocklist(
  blocklist: Blocklist,
  artist: BlockedArtist,
): Blocklist {
  const blocked = isArtistBlocked(artist.mbid, artist.name, blocklist);
  if (blocked) {
    const targetMbid = artist.mbid?.toLowerCase() ?? null;
    const targetName = artist.name?.trim().toLowerCase() ?? "";
    return {
      ...blocklist,
      artists: blocklist.artists.filter((entry) => {
        const entryMbid = entry.mbid?.toLowerCase() ?? null;
        const entryName = entry.name?.trim().toLowerCase() ?? "";
        if (targetMbid && entryMbid) return entryMbid !== targetMbid;
        if (!targetMbid && targetName) return entryName !== targetName;
        return true;
      }),
    };
  }
  return {
    ...blocklist,
    artists: [...blocklist.artists, artist],
  };
}

export function removeArtistFromBlocklist(
  blocklist: Blocklist,
  entry: BlockedArtist,
): Blocklist {
  return toggleArtistInBlocklist(
    {
      ...blocklist,
      artists: blocklist.artists.filter((a) => {
        const aMbid = a.mbid?.toLowerCase() ?? null;
        const eMbid = entry.mbid?.toLowerCase() ?? null;
        const aName = a.name?.trim().toLowerCase() ?? "";
        const eName = entry.name?.trim().toLowerCase() ?? "";
        if (eMbid && aMbid) return aMbid !== eMbid;
        if (!eMbid && eName) return aName !== eName;
        return true;
      }),
    },
    entry,
  );
}

export function addTagToBlocklist(
  blocklist: Blocklist,
  tag: string,
): Blocklist {
  const normalized = tag.trim().toLowerCase();
  if (!normalized || blocklist.tags.includes(normalized)) return blocklist;
  return { ...blocklist, tags: [...blocklist.tags, normalized] };
}

export function removeTagFromBlocklist(
  blocklist: Blocklist,
  tag: string,
): Blocklist {
  const normalized = tag.trim().toLowerCase();
  return {
    ...blocklist,
    tags: blocklist.tags.filter((t) => t !== normalized),
  };
}

export function blockedArtistKey(entry: BlockedArtist): string {
  return entry.mbid
    ? `mbid:${entry.mbid.toLowerCase()}`
    : `name:${(entry.name ?? "").toLowerCase()}`;
}
