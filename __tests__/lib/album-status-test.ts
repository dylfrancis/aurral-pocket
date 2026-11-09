import {
  canResearchAurralAlbum,
  formatReleaseWait,
  isUnreleased,
} from "@/lib/album-status";

describe("formatReleaseWait", () => {
  it.each([
    // Scanned albums often carry only the tag's year.
    ["2027", "Downloads in 2027"],
    ["2027-03", "Downloads in March 2027"],
    ["2027-03-05", "Downloads Mar 5, 2027"],
    // Lidarr's UTC midnight is still that calendar day, wherever the device is.
    ["2027-03-05T00:00:00Z", "Downloads Mar 5, 2027"],
    [null, "Downloads when it's out"],
  ])("words %p as %p", (releaseDate, label) => {
    expect(formatReleaseWait(releaseDate)).toBe(label);
  });
});

describe("isUnreleased", () => {
  // Late on Nov 9 in UTC, already Nov 10 east of Greenwich.
  const now = Date.parse("2026-11-09T23:30:00Z");

  it.each([
    ["2026-11-10", true],
    ["2026-11-09", false],
    ["2027", true],
    ["2026", false],
    [null, false],
  ])("reads %p as unreleased: %p", (releaseDate, unreleased) => {
    expect(isUnreleased(releaseDate, now)).toBe(unreleased);
  });
});

describe("canResearchAurralAlbum", () => {
  it.each([
    [true, "queued", false],
    [false, "downloading", false],
    [true, "blocked", false],
    [true, "unreleased", false],
    [false, "unreleased", true],
    // An unmonitored album reads complete with tracks still missing.
    [false, "complete", true],
    [true, "complete", false],
    [true, "partial", true],
    [true, "cancelled", true],
    [false, undefined, false],
  ])("monitored %p at %p can re-search: %p", (monitored, status, expected) => {
    expect(canResearchAurralAlbum({ monitored }, status)).toBe(expected);
  });
});
