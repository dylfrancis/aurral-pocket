import type { BasedOnArtist, DiscoveryArtist } from "@/lib/types/search";

// Grouping and labelling rules match Aurral's web Recommended page, so an
// artist sits in the same group and gives the same reason on both.

const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000;
const SEED_RAIL_LIMIT = 3;
const SEED_RAIL_MIN = 4;
const GENRE_RAIL_LIMIT = 8;

export type RecommendedFilter =
  | { kind: "all" | "new" | "close" | "further" }
  | { kind: "genre" | "seed"; value: string };

export type RecommendedSort =
  "rank" | "newest" | "oldest" | "name-asc" | "name-desc";

export type RecommendationContext = {
  newSince: number;
  seeds: ReadonlySet<string>;
};

export type RecommendedRow = { artist: DiscoveryArtist; rank: number };

export function seedNameSet(basedOn: BasedOnArtist[]): ReadonlySet<string> {
  return new Set(basedOn.flatMap((seed) => (seed.name ? [seed.name] : [])));
}

function supportingNames(artist: DiscoveryArtist): string[] {
  return artist.supportingSeeds.flatMap((seed) =>
    seed.artistName ? [seed.artistName] : [],
  );
}

export function firstGenre(artist: DiscoveryArtist): string {
  return artist.matchedTags[0] ?? artist.tags?.[0] ?? "";
}

export function isFurtherOut(artist: DiscoveryArtist): boolean {
  return artist.discoveryDepth >= 2;
}

export function firstSeenAt(artist: DiscoveryArtist): number | null {
  const time = Date.parse(artist.firstDiscoveredAt ?? "");
  return Number.isFinite(time) ? time : null;
}

/** Strongest first: the rails group an artist under the first one. */
export function likedSeeds(
  artist: DiscoveryArtist,
  seeds: ReadonlySet<string>,
): string[] {
  return [
    ...new Set(
      [...supportingNames(artist), ...artist.sourceArtists].filter((name) =>
        seeds.has(name),
      ),
    ),
  ];
}

export function pickReason(
  artist: DiscoveryArtist,
  seeds: ReadonlySet<string>,
): { kind: "like" | "via"; names: string[] } {
  return isFurtherOut(artist)
    ? { kind: "via", names: supportingNames(artist) }
    : { kind: "like", names: likedSeeds(artist, seeds) };
}

/** "like Slowdive, Low", "via Grouper", or the artist's first genre. */
export function recommendationReason(
  artist: DiscoveryArtist,
  seeds: ReadonlySet<string>,
): string {
  const { kind, names } = pickReason(artist, seeds);
  return names.length > 0
    ? `${kind} ${names.slice(0, 2).join(", ")}`
    : firstGenre(artist);
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function topPickReason(
  artist: DiscoveryArtist,
  seeds: ReadonlySet<string>,
): string | null {
  const { kind, names } = pickReason(artist, seeds);
  if (names.length === 0) return null;
  const joined = joinNames(names.slice(0, 3));
  return kind === "like" ? `Because you like ${joined}` : `via ${joined}`;
}

function newSinceTime(recommendations: DiscoveryArtist[], now: number): number {
  const times = recommendations.flatMap((artist) => firstSeenAt(artist) ?? []);
  if (times.length === 0) return Infinity;
  // The first discovery run sees every artist at once; none of them is new.
  return Math.max(Math.min(...times) + 1, now - NEW_FOR_MS);
}

export function recommendationContext(
  recommendations: DiscoveryArtist[],
  basedOn: BasedOnArtist[],
  now: number,
): RecommendationContext {
  return {
    newSince: newSinceTime(recommendations, now),
    seeds: seedNameSet(basedOn),
  };
}

function isNew(artist: DiscoveryArtist, newSince: number): boolean {
  return (firstSeenAt(artist) ?? -Infinity) >= newSince;
}

export function buildRecommendedRails(
  recommendations: DiscoveryArtist[],
  { newSince, seeds }: RecommendationContext,
) {
  const [topPick, ...rest] = recommendations;
  const fresh = rest.filter((artist) => isNew(artist, newSince));
  const settled = rest.filter((artist) => !isNew(artist, newSince));
  const furtherOut = settled.filter(isFurtherOut);
  const direct = settled.filter((artist) => !isFurtherOut(artist));
  const strongestSeed = (artist: DiscoveryArtist) =>
    likedSeeds(artist, seeds)[0];
  const seedCounts = new Map<string, number>();
  for (const artist of direct) {
    const seed = strongestSeed(artist);
    if (seed) seedCounts.set(seed, (seedCounts.get(seed) ?? 0) + 1);
  }
  const railSeeds = [...seedCounts]
    .filter(([, count]) => count >= SEED_RAIL_MIN)
    .sort((left, right) => right[1] - left[1])
    .slice(0, SEED_RAIL_LIMIT)
    .map(([seed]) => seed);
  return {
    topPick: topPick as DiscoveryArtist | undefined,
    fresh,
    seedRails: railSeeds.map((seed) => ({
      seed,
      artists: direct.filter((artist) => strongestSeed(artist) === seed),
    })),
    closeToHome: direct.filter(
      (artist) => !railSeeds.includes(strongestSeed(artist) ?? ""),
    ),
    furtherOut,
  };
}

export type RecommendedRails = ReturnType<typeof buildRecommendedRails>;

function matchesGenre(artist: DiscoveryArtist, genre: string): boolean {
  const needle = genre.toLowerCase();
  return artist.matchedTags.some((tag) => tag.toLowerCase().includes(needle));
}

export function matchesFilter(
  artist: DiscoveryArtist,
  filter: RecommendedFilter,
  { newSince, seeds }: RecommendationContext,
): boolean {
  switch (filter.kind) {
    case "all":
      return true;
    case "new":
      return isNew(artist, newSince);
    case "close":
      return !isFurtherOut(artist);
    case "further":
      return isFurtherOut(artist);
    case "genre":
      return matchesGenre(artist, filter.value);
    case "seed":
      return (
        !isFurtherOut(artist) &&
        likedSeeds(artist, seeds).includes(filter.value)
      );
  }
}

const RAIL_TITLES = {
  all: "All Recommendations",
  new: "New this week",
  close: "Close to home",
  further: "Further out",
} as const;

export function recommendedRailTitle(filter: RecommendedFilter): string {
  if (filter.kind === "seed") return `Because you like ${filter.value}`;
  if (filter.kind === "genre") return filter.value;
  return RAIL_TITLES[filter.kind];
}

export function recommendedGenres(
  recommendations: DiscoveryArtist[],
  topGenres: string[],
  context: RecommendationContext,
): { genre: string; artists: DiscoveryArtist[] }[] {
  return topGenres
    .map((genre) => ({
      genre,
      artists: recommendations.filter((artist) =>
        matchesFilter(artist, { kind: "genre", value: genre }, context),
      ),
    }))
    .filter(({ artists }) => artists.length > 0)
    .slice(0, GENRE_RAIL_LIMIT)
    .sort((left, right) => right.artists.length - left.artists.length);
}

export type RecommendedFilterOption = {
  key: string;
  label: string;
  count: number;
  filter: RecommendedFilter;
};

export function filterKey(filter: RecommendedFilter): string {
  return filter.kind === "genre" || filter.kind === "seed"
    ? `${filter.kind}:${filter.value}`
    : filter.kind;
}

const PILL_LABELS = {
  all: "All",
  new: "New",
  close: "Close to home",
  further: "Further out",
} as const;

/** An active filter that isn't otherwise offered, such as a seed, leads. */
export function recommendedFilterOptions(
  recommendations: DiscoveryArtist[],
  topGenres: string[],
  context: RecommendationContext,
  active: RecommendedFilter,
): RecommendedFilterOption[] {
  const toOption = (
    filter: RecommendedFilter,
    count: number,
  ): RecommendedFilterOption => ({
    key: filterKey(filter),
    label:
      filter.kind === "genre" || filter.kind === "seed"
        ? recommendedRailTitle(filter)
        : PILL_LABELS[filter.kind],
    count,
    filter,
  });
  const countedOption = (filter: RecommendedFilter) =>
    toOption(
      filter,
      recommendations.filter((artist) => matchesFilter(artist, filter, context))
        .length,
    );
  const fixedOptions = (["all", "new", "close", "further"] as const)
    .map((kind) => countedOption({ kind }))
    .filter((option) => option.count > 0 || option.filter.kind === "all");
  const genreOptions = recommendedGenres(
    recommendations,
    topGenres,
    context,
  ).map(({ genre, artists }) =>
    toOption({ kind: "genre", value: genre }, artists.length),
  );
  const options = [...fixedOptions, ...genreOptions];
  const activeKey = filterKey(active);
  return options.some((option) => option.key === activeKey)
    ? options
    : [countedOption(active), ...options];
}

export function recommendedFilterParams(filter: RecommendedFilter): {
  filter: RecommendedFilter["kind"];
  value?: string;
} {
  return filter.kind === "genre" || filter.kind === "seed"
    ? { filter: filter.kind, value: filter.value }
    : { filter: filter.kind };
}

export function parseRecommendedFilter(
  filter?: string,
  value?: string,
): RecommendedFilter {
  if ((filter === "genre" || filter === "seed") && value) {
    return { kind: filter, value };
  }
  if (filter === "new" || filter === "close" || filter === "further") {
    return { kind: filter };
  }
  return { kind: "all" };
}

export function recommendedRows(
  recommendations: DiscoveryArtist[],
  filter: RecommendedFilter,
  sort: RecommendedSort,
  context: RecommendationContext,
): RecommendedRow[] {
  const rows = recommendations
    .map((artist, index) => ({ artist, rank: index + 1 }))
    .filter((row) => matchesFilter(row.artist, filter, context));
  const compare = (left: RecommendedRow, right: RecommendedRow): number => {
    switch (sort) {
      case "rank":
        return 0;
      case "newest":
        return (
          (firstSeenAt(right.artist) ?? 0) - (firstSeenAt(left.artist) ?? 0)
        );
      case "oldest":
        return (
          (firstSeenAt(left.artist) ?? 0) - (firstSeenAt(right.artist) ?? 0)
        );
      case "name-asc":
        return left.artist.name.localeCompare(right.artist.name);
      case "name-desc":
        return right.artist.name.localeCompare(left.artist.name);
    }
  };
  return rows.sort(
    (left, right) => compare(left, right) || left.rank - right.rank,
  );
}
