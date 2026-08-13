import { buildSharedTrackIdentity } from "@/lib/shared-track-identity";

describe("buildSharedTrackIdentity", () => {
  it("matches the server's key format", () => {
    const identity = buildSharedTrackIdentity({
      artistName: "  Radiohead ",
      trackName: "Weird Fishes",
      albumName: "In Rainbows",
      artistMbid: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
    });
    expect(identity).toBe(
      [
        "radiohead",
        "weird fishes",
        "in rainbows",
        "a74b1b7f-71a5-4011-9441-d0b5e4122711",
        "",
        "",
        "",
      ].join("\u0001"),
    );
  });

  it("treats missing optional fields as empty segments", () => {
    const identity = buildSharedTrackIdentity({
      artistName: "Radiohead",
      trackName: "Reckoner",
    });
    expect(identity).toBe(
      ["radiohead", "reckoner", "", "", "", "", ""].join("\u0001"),
    );
  });

  it("differs when the album differs, like the server's append filter", () => {
    const live = buildSharedTrackIdentity({
      artistName: "Radiohead",
      trackName: "Reckoner",
      albumName: "In Rainbows From the Basement",
    });
    const studio = buildSharedTrackIdentity({
      artistName: "Radiohead",
      trackName: "Reckoner",
      albumName: "In Rainbows",
    });
    expect(live).not.toBe(studio);
  });
});
