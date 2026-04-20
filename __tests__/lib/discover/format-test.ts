import {
  buildGenreSections,
  formatBasedOn,
  formatUpdatedAt,
  parseCalendarDate,
  formatReleaseStatus,
} from "@/lib/discover/format";
import type { DiscoveryArtist } from "@/lib/types/search";

const artist = (id: string, tags: string[] = []): DiscoveryArtist => ({
  id,
  name: `Artist ${id}`,
  tags,
});

describe("buildGenreSections", () => {
  it("returns empty when genres list is empty", () => {
    expect(buildGenreSections([], [artist("1", ["rock"])])).toEqual([]);
  });

  it("returns empty when recommendations list is empty", () => {
    expect(buildGenreSections(["rock"], [])).toEqual([]);
  });

  it("matches tags case-insensitively and as substring", () => {
    const recs = [
      artist("1", ["Indie Rock"]),
      artist("2", ["Rock"]),
      artist("3", ["rock and roll"]),
      artist("4", ["ROCK"]),
    ];
    const sections = buildGenreSections(["rock"], recs);
    expect(sections).toEqual([{ genre: "rock", artists: recs }]);
  });

  it("skips genres that have fewer than MIN_PER_SECTION (4) matches", () => {
    const recs = [
      artist("1", ["rock"]),
      artist("2", ["rock"]),
      artist("3", ["rock"]),
      // only 3 rock artists — skipped
      artist("4", ["jazz"]),
      artist("5", ["jazz"]),
      artist("6", ["jazz"]),
      artist("7", ["jazz"]),
    ];
    const sections = buildGenreSections(["rock", "jazz"], recs);
    expect(sections.map((s) => s.genre)).toEqual(["jazz"]);
  });

  it("caps each section at MAX_PER_SECTION (6)", () => {
    const recs = Array.from({ length: 10 }, (_, i) =>
      artist(String(i), ["rock"]),
    );
    const [section] = buildGenreSections(["rock"], recs);
    expect(section.artists).toHaveLength(6);
  });

  it("caps total sections at MAX_SECTIONS (4)", () => {
    const recs = Array.from({ length: 4 * 4 }, (_, i) =>
      artist(String(i), [["rock", "jazz", "pop", "edm", "classical"][i % 5]!]),
    );
    // 5 genres each with 4 artists — but only 4 sections should land
    const sections = buildGenreSections(
      ["rock", "jazz", "pop", "edm", "classical"],
      recs,
    );
    expect(sections.length).toBeLessThanOrEqual(4);
  });

  it("dedupes artists across sections (first genre wins)", () => {
    const shared = artist("shared", ["rock", "jazz"]);
    const recs = [
      shared,
      artist("r1", ["rock"]),
      artist("r2", ["rock"]),
      artist("r3", ["rock"]),
      artist("r4", ["rock"]),
      artist("j1", ["jazz"]),
      artist("j2", ["jazz"]),
      artist("j3", ["jazz"]),
      artist("j4", ["jazz"]),
    ];
    const sections = buildGenreSections(["jazz", "rock"], recs);
    const jazzIds = sections
      .find((s) => s.genre === "jazz")
      ?.artists.map((a) => a.id);
    const rockIds = sections
      .find((s) => s.genre === "rock")
      ?.artists.map((a) => a.id);
    // alphabetical sort → jazz first, claims shared
    expect(jazzIds).toContain("shared");
    expect(rockIds).toBeDefined();
    expect(rockIds).not.toContain("shared");
  });

  it("sorts genres alphabetically before picking sections", () => {
    const recs = [
      artist("p1", ["pop"]),
      artist("p2", ["pop"]),
      artist("p3", ["pop"]),
      artist("p4", ["pop"]),
      artist("a1", ["alt"]),
      artist("a2", ["alt"]),
      artist("a3", ["alt"]),
      artist("a4", ["alt"]),
    ];
    const sections = buildGenreSections(["pop", "alt"], recs);
    expect(sections.map((s) => s.genre)).toEqual(["alt", "pop"]);
  });

  it("treats artists without tags as non-matching", () => {
    const recs = [artist("1"), artist("2"), artist("3"), artist("4")];
    expect(buildGenreSections(["rock"], recs)).toEqual([]);
  });
});

describe("formatBasedOn", () => {
  it("returns null for empty list", () => {
    expect(formatBasedOn([])).toBeNull();
  });

  it("returns null when all names are empty strings", () => {
    expect(formatBasedOn([{ name: "" }, { name: "" }])).toBeNull();
  });

  it("formats one artist", () => {
    expect(formatBasedOn([{ name: "Radiohead" }])).toBe("Based on Radiohead");
  });

  it("formats two artists with 'and'", () => {
    expect(formatBasedOn([{ name: "A" }, { name: "B" }])).toBe(
      "Based on A and B",
    );
  });

  it("formats three artists with 1 other (singular)", () => {
    expect(formatBasedOn([{ name: "A" }, { name: "B" }, { name: "C" }])).toBe(
      "Based on A, B and 1 other artist",
    );
  });

  it("formats five artists with 3 others (plural)", () => {
    expect(
      formatBasedOn([
        { name: "A" },
        { name: "B" },
        { name: "C" },
        { name: "D" },
        { name: "E" },
      ]),
    ).toBe("Based on A, B and 3 other artists");
  });
});

describe("formatUpdatedAt", () => {
  it("returns null for null input", () => {
    expect(formatUpdatedAt(null)).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(formatUpdatedAt("not-a-date")).toBeNull();
  });

  it("returns a formatted string for valid ISO date", () => {
    const result = formatUpdatedAt("2026-04-20T12:00:00Z");
    expect(typeof result).toBe("string");
    expect(result).toContain("2026");
  });
});

describe("parseCalendarDate", () => {
  it("returns null for null/undefined/empty", () => {
    expect(parseCalendarDate(null)).toBeNull();
    expect(parseCalendarDate(undefined)).toBeNull();
    expect(parseCalendarDate("")).toBeNull();
  });

  it("parses YYYY-MM-DD as local calendar date", () => {
    const d = parseCalendarDate("2024-03-15");
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(15);
  });

  it("returns null for unparseable string", () => {
    expect(parseCalendarDate("garbage")).toBeNull();
  });

  it("strips time from full ISO timestamps", () => {
    const d = parseCalendarDate("2024-03-15T23:59:59Z");
    expect(d?.getHours()).toBe(0);
    expect(d?.getMinutes()).toBe(0);
  });
});

describe("formatReleaseStatus", () => {
  it("returns null for null/invalid dates", () => {
    expect(formatReleaseStatus(null)).toBeNull();
    expect(formatReleaseStatus("garbage")).toBeNull();
  });

  it("says 'Released today' when the date matches today", () => {
    const today = new Date(2026, 3, 20);
    expect(formatReleaseStatus("2026-04-20", today)).toBe("Released today");
  });

  it("says 'Released <date>' for past dates", () => {
    const today = new Date(2026, 3, 20);
    const result = formatReleaseStatus("2024-01-01", today);
    expect(result).toMatch(/^Released /);
  });

  it("says 'Releasing <date>' for future dates", () => {
    const today = new Date(2026, 3, 20);
    const result = formatReleaseStatus("2027-01-01", today);
    expect(result).toMatch(/^Releasing /);
  });
});
