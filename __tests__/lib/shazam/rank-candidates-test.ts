import { rankCandidates } from "@/lib/shazam/rank-candidates";
import type { IsrcArtist } from "@/lib/api/musicbrainz";
import type { SearchArtist } from "@/lib/types/search";

function artist(id: string, name = id): SearchArtist {
  return {
    id,
    name,
    "sort-name": name,
    image: null,
    imageUrl: null,
    listeners: null,
  };
}

const results = [
  artist("a"),
  artist("b"),
  artist("c"),
  artist("d"),
  artist("e"),
];

describe("rankCandidates", () => {
  it("returns the top-N name-search results when there's no ISRC artist", () => {
    const { candidates, hasBestMatch } = rankCandidates(results, null, 3);
    expect(candidates.map((a) => a.id)).toEqual(["a", "b", "c"]);
    expect(hasBestMatch).toBe(false);
  });

  it("shows only the ISRC artist when one resolves, even if buried", () => {
    const isrc: IsrcArtist = { mbid: "d", name: "Her's" };
    const { candidates, hasBestMatch } = rankCandidates(results, isrc, 5);
    expect(candidates.map((a) => a.id)).toEqual(["d"]);
    expect(hasBestMatch).toBe(true);
  });

  it("synthesises the sole row when the ISRC artist isn't in the results", () => {
    const isrc: IsrcArtist = { mbid: "zzz", name: "Her's" };
    const { candidates, hasBestMatch } = rankCandidates(results, isrc, 3);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: "zzz", name: "Her's" });
    expect(hasBestMatch).toBe(true);
  });
});
