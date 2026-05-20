import {
  addTagToBlocklist,
  blockedArtistKey,
  isArtistBlocked,
  isValidMbid,
  normalizeArtists,
  normalizeBlocklist,
  normalizeTags,
  removeArtistFromBlocklist,
  removeTagFromBlocklist,
  toggleArtistInBlocklist,
} from "@/lib/blocklist";
import type { Blocklist } from "@/lib/types/discover";

const MBID_A = "11111111-1111-1111-1111-111111111111";
const MBID_B = "22222222-2222-2222-2222-222222222222";

describe("isValidMbid", () => {
  it("accepts a canonical lowercase mbid", () => {
    expect(isValidMbid(MBID_A)).toBe(true);
  });

  it("accepts uppercase and trims whitespace", () => {
    expect(isValidMbid(`  ${MBID_A.toUpperCase()}  `)).toBe(true);
  });

  it("rejects empty and non-mbid strings", () => {
    expect(isValidMbid("")).toBe(false);
    expect(isValidMbid(null)).toBe(false);
    expect(isValidMbid(undefined)).toBe(false);
    expect(isValidMbid("not-an-mbid")).toBe(false);
    expect(isValidMbid("11111111-1111-1111-1111")).toBe(false);
  });
});

describe("normalizeArtists", () => {
  it("returns empty array for non-array input", () => {
    expect(normalizeArtists(null)).toEqual([]);
    expect(normalizeArtists(undefined)).toEqual([]);
  });

  it("lowercases mbids and keeps original-case names", () => {
    const result = normalizeArtists([
      { mbid: MBID_A.toUpperCase(), name: "Nickelback" },
    ]);
    expect(result).toEqual([{ mbid: MBID_A, name: "Nickelback" }]);
  });

  it("drops invalid mbids but keeps the name", () => {
    const result = normalizeArtists([{ mbid: "bogus", name: "Maroon 5" }]);
    expect(result).toEqual([{ mbid: null, name: "Maroon 5" }]);
  });

  it("drops entries with neither mbid nor name", () => {
    expect(normalizeArtists([{ mbid: null, name: null }])).toEqual([]);
    expect(normalizeArtists([{ mbid: "", name: "  " }])).toEqual([]);
  });

  it("dedupes by mbid (case-insensitive), keeping first", () => {
    const result = normalizeArtists([
      { mbid: MBID_A, name: "First" },
      { mbid: MBID_A.toUpperCase(), name: "Second" },
    ]);
    expect(result).toEqual([{ mbid: MBID_A, name: "First" }]);
  });

  it("dedupes by name (case-insensitive) when mbid is absent", () => {
    const result = normalizeArtists([
      { mbid: null, name: "Nickelback" },
      { mbid: null, name: "nickelback" },
    ]);
    expect(result).toEqual([{ mbid: null, name: "Nickelback" }]);
  });

  it("treats mbid and name entries as distinct (no cross-dedup)", () => {
    const result = normalizeArtists([
      { mbid: MBID_A, name: "Match" },
      { mbid: null, name: "Match" },
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("normalizeTags", () => {
  it("lowercases and trims tags", () => {
    expect(normalizeTags(["  Post-Hardcore  ", "NU-Metal"])).toEqual([
      "post-hardcore",
      "nu-metal",
    ]);
  });

  it("dedupes case-insensitively", () => {
    expect(normalizeTags(["pop", "POP", " pop "])).toEqual(["pop"]);
  });

  it("drops empty/whitespace entries", () => {
    expect(normalizeTags(["", "  ", null, undefined, "rock"])).toEqual([
      "rock",
    ]);
  });

  it("returns empty array for non-array input", () => {
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags(undefined)).toEqual([]);
  });
});

describe("normalizeBlocklist", () => {
  it("normalizes both artists and tags", () => {
    const result = normalizeBlocklist({
      artists: [{ mbid: MBID_A.toUpperCase(), name: "Foo" }],
      tags: ["POP", "pop"],
    });
    expect(result).toEqual({
      artists: [{ mbid: MBID_A, name: "Foo" }],
      tags: ["pop"],
    });
  });

  it("returns empty arrays for missing input", () => {
    expect(normalizeBlocklist(null)).toEqual({ artists: [], tags: [] });
    expect(normalizeBlocklist(undefined)).toEqual({ artists: [], tags: [] });
    expect(normalizeBlocklist({})).toEqual({ artists: [], tags: [] });
  });
});

describe("isArtistBlocked", () => {
  const blocklist: Blocklist = {
    artists: [
      { mbid: MBID_A, name: "Has Mbid" },
      { mbid: null, name: "Name Only" },
    ],
    tags: [],
  };

  it("returns false when blocklist is null/undefined", () => {
    expect(isArtistBlocked(MBID_A, "anything", null)).toBe(false);
    expect(isArtistBlocked(MBID_A, "anything", undefined)).toBe(false);
  });

  it("matches by mbid case-insensitively", () => {
    expect(isArtistBlocked(MBID_A.toUpperCase(), "Different", blocklist)).toBe(
      true,
    );
  });

  it("returns false when mbid is present but doesn't match", () => {
    expect(isArtistBlocked(MBID_B, "Has Mbid", blocklist)).toBe(false);
  });

  it("falls back to name match when candidate has no mbid", () => {
    expect(isArtistBlocked(null, "name only", blocklist)).toBe(true);
    expect(isArtistBlocked(undefined, "Name Only", blocklist)).toBe(true);
  });

  it("does not match by name when candidate has a valid mbid", () => {
    expect(isArtistBlocked(MBID_B, "Name Only", blocklist)).toBe(false);
  });
});

describe("toggleArtistInBlocklist", () => {
  it("adds an unblocked artist", () => {
    const start: Blocklist = { artists: [], tags: ["pop"] };
    const next = toggleArtistInBlocklist(start, {
      mbid: MBID_A,
      name: "New",
    });
    expect(next.artists).toEqual([{ mbid: MBID_A, name: "New" }]);
    expect(next.tags).toEqual(["pop"]);
  });

  it("removes a blocked artist by mbid", () => {
    const start: Blocklist = {
      artists: [
        { mbid: MBID_A, name: "Gone" },
        { mbid: MBID_B, name: "Stays" },
      ],
      tags: [],
    };
    const next = toggleArtistInBlocklist(start, {
      mbid: MBID_A,
      name: "Gone",
    });
    expect(next.artists).toEqual([{ mbid: MBID_B, name: "Stays" }]);
  });

  it("removes a name-only blocked artist when toggled without mbid", () => {
    const start: Blocklist = {
      artists: [{ mbid: null, name: "TypedName" }],
      tags: [],
    };
    const next = toggleArtistInBlocklist(start, {
      mbid: null,
      name: "typedname",
    });
    expect(next.artists).toEqual([]);
  });
});

describe("addTagToBlocklist / removeTagFromBlocklist", () => {
  it("adds a normalized tag", () => {
    const start: Blocklist = { artists: [], tags: ["rock"] };
    const next = addTagToBlocklist(start, "  POP  ");
    expect(next.tags).toEqual(["rock", "pop"]);
  });

  it("does not double-add an existing tag", () => {
    const start: Blocklist = { artists: [], tags: ["pop"] };
    const next = addTagToBlocklist(start, "POP");
    expect(next).toBe(start);
  });

  it("ignores empty tag", () => {
    const start: Blocklist = { artists: [], tags: ["pop"] };
    const next = addTagToBlocklist(start, "  ");
    expect(next).toBe(start);
  });

  it("removes a tag case-insensitively", () => {
    const start: Blocklist = { artists: [], tags: ["pop", "rock"] };
    const next = removeTagFromBlocklist(start, "POP");
    expect(next.tags).toEqual(["rock"]);
  });

  it("is a no-op when the tag is absent", () => {
    const start: Blocklist = { artists: [], tags: ["pop"] };
    const next = removeTagFromBlocklist(start, "metal");
    expect(next.tags).toEqual(["pop"]);
  });
});

describe("removeArtistFromBlocklist", () => {
  it("removes by mbid", () => {
    const start: Blocklist = {
      artists: [
        { mbid: MBID_A, name: "Gone" },
        { mbid: MBID_B, name: "Stays" },
      ],
      tags: [],
    };
    const next = removeArtistFromBlocklist(start, {
      mbid: MBID_A,
      name: null,
    });
    expect(next.artists).toEqual([{ mbid: MBID_B, name: "Stays" }]);
  });

  it("removes by name when mbid is null on both sides", () => {
    const start: Blocklist = {
      artists: [
        { mbid: null, name: "Gone" },
        { mbid: null, name: "Stays" },
      ],
      tags: [],
    };
    const next = removeArtistFromBlocklist(start, { mbid: null, name: "gone" });
    expect(next.artists).toEqual([{ mbid: null, name: "Stays" }]);
  });

  it("is a no-op when the entry is not present", () => {
    const start: Blocklist = {
      artists: [{ mbid: MBID_A, name: "Stays" }],
      tags: [],
    };
    const next = removeArtistFromBlocklist(start, {
      mbid: MBID_B,
      name: "Other",
    });
    expect(next.artists).toEqual([{ mbid: MBID_A, name: "Stays" }]);
  });
});

describe("blockedArtistKey", () => {
  it("prefers mbid key when present", () => {
    expect(blockedArtistKey({ mbid: MBID_A, name: "Foo" })).toBe(
      `mbid:${MBID_A}`,
    );
  });

  it("falls back to lowercase name key", () => {
    expect(blockedArtistKey({ mbid: null, name: "Foo" })).toBe("name:foo");
  });

  it("handles a missing name when mbid is absent", () => {
    expect(blockedArtistKey({ mbid: null, name: null })).toBe("name:");
  });
});
