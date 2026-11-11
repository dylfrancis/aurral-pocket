import {
  buildRecommendedRails,
  recommendationContext,
  recommendationReason,
  recommendedFilterOptions,
  recommendedGenres,
  recommendedRows,
  topPickReason,
} from "@/lib/discover/recommended";
import type { DiscoveryArtist } from "@/lib/types/search";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-09T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();

const artist = (
  name: string,
  overrides: Partial<DiscoveryArtist> = {},
): DiscoveryArtist => ({
  id: name.toLowerCase(),
  name,
  tags: [],
  matchedTags: [],
  sourceArtist: null,
  sourceArtists: [],
  supportingSeeds: [],
  discoveryTier: null,
  discoveryDepth: 1,
  firstDiscoveredAt: daysAgo(30),
  ...overrides,
});

const seededBy = (...names: string[]) => ({
  supportingSeeds: names.map((artistName) => ({ artistName })),
});

const SEEDS = new Set(["Slowdive", "Low", "Duster"]);
const basedOn = [...SEEDS].map((name) => ({ name }));

describe("recommendationReason", () => {
  it.each([
    [
      "names up to two seeds it is like",
      artist("Lush", seededBy("Slowdive", "Low", "Duster")),
      "like Slowdive, Low",
    ],
    [
      "counts only seeds, from supporting seeds or source artists",
      artist("Ride", { ...seededBy("Nobody"), sourceArtists: ["Low"] }),
      "like Low",
    ],
    [
      "names who led to an artist further out",
      artist("Hum", { ...seededBy("Grouper"), discoveryDepth: 2 }),
      "via Grouper",
    ],
    [
      "falls back to the first matched genre",
      artist("Swirlies", { tags: ["indie"], matchedTags: ["shoegaze"] }),
      "shoegaze",
    ],
    [
      "falls back to the first tag",
      artist("Swirlies", { tags: ["indie"] }),
      "indie",
    ],
  ])("%s", (_, recommendation, reason) => {
    expect(recommendationReason(recommendation, SEEDS)).toBe(reason);
  });
});

describe("topPickReason", () => {
  it("lists up to three seeds, or who led to it", () => {
    expect(
      topPickReason(
        artist("Lush", seededBy("Slowdive", "Low", "Duster")),
        SEEDS,
      ),
    ).toBe("Because you like Slowdive, Low and Duster");
    expect(
      topPickReason(
        artist("Hum", { ...seededBy("Grouper", "Jessica"), discoveryDepth: 2 }),
        SEEDS,
      ),
    ).toBe("via Grouper and Jessica");
    expect(topPickReason(artist("Swirlies"), SEEDS)).toBeNull();
  });
});

describe("buildRecommendedRails", () => {
  const likes = (seed: string, count: number) =>
    Array.from({ length: count }, (_, index) =>
      artist(`${seed} fan ${index + 1}`, seededBy(seed)),
    );

  it("groups artists by why they showed up", () => {
    const recommendations = [
      artist("Top", seededBy("Slowdive")),
      artist("Fresh", {
        ...seededBy("Slowdive"),
        firstDiscoveredAt: daysAgo(1),
      }),
      ...likes("Slowdive", 5),
      ...likes("Low", 4),
      // Too few to earn their own rail.
      ...likes("Duster", 3),
      artist("Far", { ...seededBy("Grouper"), discoveryDepth: 2 }),
    ];
    const context = recommendationContext(recommendations, basedOn, NOW);
    const rails = buildRecommendedRails(recommendations, context);
    const names = (artists: DiscoveryArtist[]) => artists.map((a) => a.name);

    expect(rails.topPick?.name).toBe("Top");
    expect(names(rails.fresh)).toEqual(["Fresh"]);
    expect(
      rails.seedRails.map(({ seed, artists }) => [seed, artists.length]),
    ).toEqual([
      ["Slowdive", 5],
      ["Low", 4],
    ]);
    expect(names(rails.closeToHome)).toEqual(names(likes("Duster", 3)));
    expect(names(rails.furtherOut)).toEqual(["Far"]);
  });

  it("calls nothing new when every artist came from the first run", () => {
    const recommendations = ["A", "B", "C"].map((name) =>
      artist(name, { firstDiscoveredAt: daysAgo(1) }),
    );
    const context = recommendationContext(recommendations, basedOn, NOW);

    expect(buildRecommendedRails(recommendations, context).fresh).toEqual([]);
  });
});

describe("recommendedGenres", () => {
  it("keeps the top genres with picks, most picks first", () => {
    const recommendations = [
      artist("Lush", { matchedTags: ["shoegaze"] }),
      artist("Ride", { matchedTags: ["shoegaze", "rock"] }),
      artist("Hum", { matchedTags: ["rock"] }),
      artist("Codeine", { matchedTags: ["Indie Rock"] }),
    ];
    const context = recommendationContext(recommendations, basedOn, NOW);

    expect(
      recommendedGenres(
        recommendations,
        ["shoegaze", "jazz", "rock"],
        context,
      ).map(({ genre, artists }) => `${genre} ${artists.length}`),
    ).toEqual(["rock 3", "shoegaze 2"]);
  });
});

describe("recommendedFilterOptions", () => {
  const recommendations = [
    artist("Lush", { ...seededBy("Slowdive"), matchedTags: ["shoegaze"] }),
    artist("Ride", {
      ...seededBy("Slowdive"),
      matchedTags: ["shoegaze", "rock"],
    }),
    artist("Hum", { discoveryDepth: 2, matchedTags: ["rock"] }),
    artist("Codeine", { matchedTags: ["rock"] }),
  ];
  const context = recommendationContext(recommendations, basedOn, NOW);
  const summary = (filter: Parameters<typeof recommendedFilterOptions>[3]) =>
    recommendedFilterOptions(
      recommendations,
      ["shoegaze", "jazz", "rock"],
      context,
      filter,
    ).map((option) => `${option.label} ${option.count}`);

  it("counts each filter, leaving out empty ones and ordering genres by count", () => {
    expect(summary({ kind: "all" })).toEqual([
      "All 4",
      "Close to home 3",
      "Further out 1",
      "rock 3",
      "shoegaze 2",
    ]);
  });

  it("leads with an active seed filter", () => {
    expect(summary({ kind: "seed", value: "Slowdive" })[0]).toBe(
      "Because you like Slowdive 2",
    );
  });
});

describe("recommendedRows", () => {
  const recommendations = [
    artist("Beta", { firstDiscoveredAt: daysAgo(3) }),
    artist("Alpha", { firstDiscoveredAt: daysAgo(10) }),
    artist("Gamma", { firstDiscoveredAt: daysAgo(3) }),
  ];
  const context = recommendationContext(recommendations, basedOn, NOW);
  const order = (sort: Parameters<typeof recommendedRows>[2]) =>
    recommendedRows(recommendations, { kind: "all" }, sort, context).map(
      ({ artist: { name }, rank }) => `${rank} ${name}`,
    );

  it("sorts by rank, first seen or name, breaking ties by rank", () => {
    expect(order("rank")).toEqual(["1 Beta", "2 Alpha", "3 Gamma"]);
    expect(order("newest")).toEqual(["1 Beta", "3 Gamma", "2 Alpha"]);
    expect(order("oldest")).toEqual(["2 Alpha", "1 Beta", "3 Gamma"]);
    expect(order("name-desc")).toEqual(["3 Gamma", "1 Beta", "2 Alpha"]);
  });
});
