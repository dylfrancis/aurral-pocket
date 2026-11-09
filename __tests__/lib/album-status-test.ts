import { formatReleaseWait } from "@/lib/album-status";

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
