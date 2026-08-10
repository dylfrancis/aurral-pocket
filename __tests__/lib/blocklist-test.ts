import {
  isArtistBlocked,
  isValidMbid,
  selectBlockedArtists,
} from "@/lib/blocklist";
import type { DiscoveryFeedbackEntry } from "@/lib/types/discovery-feedback";

const NOW = Date.parse("2026-08-09T00:00:00.000Z");

function entry(
  overrides: Partial<DiscoveryFeedbackEntry> = {},
): DiscoveryFeedbackEntry {
  return {
    id: "fb-1",
    artistId: "11111111-1111-1111-1111-111111111111",
    artistName: "Boards of Canada",
    action: "block_artist",
    sourceContext: "blocklist",
    createdAt: "2026-08-01T00:00:00.000Z",
    expiresAt: null,
    ...overrides,
  };
}

describe("selectBlockedArtists", () => {
  it("keeps only block_artist entries", () => {
    const result = selectBlockedArtists(
      [
        entry(),
        entry({ id: "fb-2", action: "more_like_this", artistName: "Aphex" }),
        entry({ id: "fb-3", action: "less_like_this", artistName: "Autechre" }),
      ],
      NOW,
    );
    expect(result.map((a) => a.name)).toEqual(["Boards of Canada"]);
  });

  it("drops entries whose expiresAt has passed", () => {
    const result = selectBlockedArtists(
      [
        entry({ id: "live", expiresAt: "2026-09-01T00:00:00.000Z" }),
        entry({
          id: "dead",
          artistName: "Expired Artist",
          artistId: null,
          expiresAt: "2026-08-08T00:00:00.000Z",
        }),
      ],
      NOW,
    );
    expect(result.map((a) => a.id)).toEqual(["live"]);
  });

  it("treats a missing or unparseable expiresAt as never expiring", () => {
    const result = selectBlockedArtists(
      [
        entry({ id: "no-expiry", expiresAt: null }),
        entry({
          id: "bad-expiry",
          artistName: "Other",
          artistId: null,
          expiresAt: "not-a-date",
        }),
      ],
      NOW,
    );
    expect(result).toHaveLength(2);
  });

  it("drops entries with no id, since unblocking addresses them by id", () => {
    const result = selectBlockedArtists([entry({ id: null })], NOW);
    expect(result).toEqual([]);
  });

  it("drops entries with neither an id nor a name to show", () => {
    const result = selectBlockedArtists(
      [entry({ artistId: null, artistName: "  " })],
      NOW,
    );
    expect(result).toEqual([]);
  });

  it("dedupes on artistId, then name, and sorts by name", () => {
    const result = selectBlockedArtists(
      [
        entry({ id: "b", artistId: null, artistName: "Zomby" }),
        entry({ id: "a", artistId: null, artistName: "Aphex Twin" }),
        entry({ id: "dupe", artistId: null, artistName: "aphex twin" }),
      ],
      NOW,
    );
    expect(result.map((a) => a.name)).toEqual(["Aphex Twin", "Zomby"]);
  });

  it("falls back to the artistId when the entry has no name", () => {
    const result = selectBlockedArtists(
      [entry({ artistName: null, artistId: "artist-7" })],
      NOW,
    );
    expect(result[0].name).toBe("artist-7");
  });

  it("returns an empty list for a missing feed", () => {
    expect(selectBlockedArtists(undefined, NOW)).toEqual([]);
  });
});

describe("isArtistBlocked", () => {
  const blocked = selectBlockedArtists(
    [entry({ id: "fb-1", artistId: "mbid-1", artistName: "Boards of Canada" })],
    NOW,
  );

  it("matches on artist id", () => {
    expect(isArtistBlocked(blocked, { id: "mbid-1", name: "Renamed" })).toBe(
      true,
    );
  });

  it("matches on name regardless of case", () => {
    expect(isArtistBlocked(blocked, { name: "boards of canada" })).toBe(true);
  });

  it("does not match an unrelated artist", () => {
    expect(isArtistBlocked(blocked, { id: "mbid-2", name: "Aphex" })).toBe(
      false,
    );
  });

  it("does not match when the candidate has neither id nor name", () => {
    expect(isArtistBlocked(blocked, {})).toBe(false);
  });
});

describe("isValidMbid", () => {
  it("accepts a UUID", () => {
    expect(isValidMbid("11111111-1111-1111-1111-111111111111")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidMbid("not-a-uuid")).toBe(false);
    expect(isValidMbid(null)).toBe(false);
    expect(isValidMbid(undefined)).toBe(false);
  });
});
