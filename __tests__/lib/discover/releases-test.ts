import { groupReleasesByMonth } from "@/lib/discover/releases";
import type { RecentReleaseAlbum } from "@/lib/types/search";

const release = (id: string, releaseDate: string): RecentReleaseAlbum => ({
  id,
  releaseGroupMbid: id,
  albumName: `Album ${id}`,
  artistName: "Artist",
  artistMbid: null,
  releaseDate,
  coverUrl: null,
  albumType: "Album",
  secondaryTypes: [],
});

describe("groupReleasesByMonth", () => {
  it("keeps the feed's order and names the year only outside this one", () => {
    const now = new Date(2026, 10, 22);
    const groups = groupReleasesByMonth(
      [
        release("a", "2026-11-20"),
        release("b", "2026-11-02"),
        release("c", "2026-10-30"),
        release("d", "2025-12-31"),
      ],
      now,
    );

    expect(
      groups.map((group) => [
        group.label,
        group.releases.map((album) => album.id),
      ]),
    ).toEqual([
      ["November", ["a", "b"]],
      ["October", ["c"]],
      ["December 2025", ["d"]],
    ]);
  });
});
