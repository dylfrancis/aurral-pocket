import type {
  MonitoringCatalog,
  MonitoringEdition,
  MonitoringPlan,
  MonitoringRules,
} from "@/lib/types/monitoring";

/** How an artist is monitored: by the default rules, its own, or not at all. */
export type MonitoringChoice = "default" | "custom" | "off";

/** What the artist page's capsule reads for each choice. */
export const MONITORING_CHOICE_LABELS: Record<MonitoringChoice, string> = {
  default: "Monitored",
  custom: "Custom Rules",
  off: "Not Monitored",
};

/** Reads an artist's monitoring, or a change to it, as a choice. */
export function monitoringChoice(monitoring: {
  monitored: boolean;
  useDefault?: boolean;
}): MonitoringChoice {
  if (!monitoring.monitored) return "off";
  return monitoring.useDefault === false ? "custom" : "default";
}

// The server's limits, from normalizeMonitorRules.
export const MAX_LATEST_RELEASES = 10;
export const MAX_TOP_TRACKS = 50;
export const FIRST_SINCE_YEAR = 1900;

export const lastSinceYear = (now = new Date()) => now.getFullYear() + 1;

type Option<Value extends string> = { value: Value; label: string };

export const CATALOG_OPTIONS: readonly Option<MonitoringCatalog>[] = [
  { value: "all", label: "Everything" },
  { value: "since", label: "Since a Year" },
  { value: "latest", label: "Latest Releases" },
  { value: "none", label: "Nothing" },
];

export const CATALOG_HINTS: Record<MonitoringCatalog, string> = {
  all: "All matching releases available now.",
  since: "Matching releases from this year on.",
  latest: "Latest matching releases available now.",
  none: "No existing releases.",
};

export const RELEASE_TYPE_OPTIONS: readonly Option<string>[] = [
  { value: "album", label: "Albums" },
  { value: "ep", label: "EPs" },
  { value: "single", label: "Singles" },
];

/** `phrase` is how a summary names the type mid-sentence. */
export const EXTRA_TYPE_OPTIONS: readonly (Option<string> & {
  phrase: string;
})[] = [
  { value: "live", label: "Live", phrase: "live" },
  { value: "compilation", label: "Compilations", phrase: "compilations" },
  { value: "soundtrack", label: "Soundtracks", phrase: "soundtracks" },
  { value: "remix", label: "Remixes", phrase: "remixes" },
  { value: "demo", label: "Demos", phrase: "demos" },
  { value: "dj-mix", label: "DJ Mixes", phrase: "DJ mixes" },
  { value: "mixtape/street", label: "Mixtapes", phrase: "mixtapes" },
];

export const EDITION_OPTIONS: readonly Option<MonitoringEdition>[] = [
  { value: "standard", label: "Standard" },
  { value: "expanded", label: "Expanded" },
];

export const EDITION_HINTS: Record<MonitoringEdition, string> = {
  standard: "The tracklist most releases of an album share.",
  expanded: "The longest edition with every standard track.",
};

/**
 * Picks a catalogue. A first "since" gets a year five back, as on the web, so
 * the rules are valid before anyone types one.
 */
export function withCatalog(
  rules: MonitoringRules,
  catalog: MonitoringCatalog,
  now = new Date(),
): MonitoringRules {
  return {
    ...rules,
    catalog,
    sinceYear:
      catalog === "since"
        ? rules.sinceYear || now.getFullYear() - 5
        : rules.sinceYear,
  };
}

/**
 * Turns one release type on or off, in the server's order. The last primary
 * type stays on, since the server needs one.
 */
export function toggleType(
  rules: MonitoringRules,
  key: "types" | "extraTypes",
  value: string,
): MonitoringRules {
  const current = rules[key];
  const on = current.includes(value);
  if (on && key === "types" && current.length === 1) return rules;
  const options = key === "types" ? RELEASE_TYPE_OPTIONS : EXTRA_TYPE_OPTIONS;
  const next = options
    .map((option) => option.value)
    .filter((type) => (type === value ? !on : current.includes(type)));
  return { ...rules, [key]: next };
}

/**
 * Why the server would refuse these rules, or null when it takes them. The
 * fields keep every other value in the server's range.
 */
export function monitoringRulesProblem(rules: MonitoringRules): string | null {
  if (rules.catalog === "none" && !rules.newReleases && rules.topTracks === 0) {
    return "Choose a back catalogue, new releases or top tracks to monitor.";
  }
  return null;
}

const joinWords = (words: string[]) =>
  words.length <= 1
    ? words.join("")
    : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

const labelsFor = (
  values: readonly string[],
  options: readonly Option<string>[],
) =>
  options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

function describeScope(rules: MonitoringRules) {
  const catalog = {
    all: "Everything",
    since: `Everything since ${rules.sinceYear}`,
    latest:
      rules.latestCount === 1
        ? "The latest release"
        : `The latest ${rules.latestCount} releases`,
    none: null,
  }[rules.catalog];
  if (!catalog) return rules.newReleases ? "New releases" : null;
  return rules.newReleases ? `${catalog} and new releases` : catalog;
}

/**
 * The web's one-line summary of a set of rules, such as "Everything and new
 * releases · Albums and EPs".
 */
export function describeMonitoringRules(rules: MonitoringRules): string {
  const scope = describeScope(rules);
  const types = joinWords(labelsFor(rules.types, RELEASE_TYPE_OPTIONS));
  const extras = EXTRA_TYPE_OPTIONS.filter((option) =>
    rules.extraTypes.includes(option.value),
  ).map((option) => option.phrase);
  const parts = [
    scope,
    scope
      ? extras.length
        ? `${types}, including ${joinWords(extras)}`
        : types
      : null,
    rules.topTracks > 0
      ? `Top ${rules.topTracks} ${rules.topTracks === 1 ? "track" : "tracks"}`
      : null,
    rules.edition === "expanded" ? "Expanded editions" : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** What a monitoring change downloads, for its toast. */
export function describeMonitoringPlan(
  plan: MonitoringPlan | undefined,
  rules: MonitoringRules | null | undefined,
): string {
  const parts = [
    plan?.releaseGroupIds.length
      ? plural(plan.releaseGroupIds.length, "release")
      : null,
    plan?.topTracks.length ? plural(plan.topTracks.length, "top track") : null,
  ].filter((part): part is string => part !== null);
  if (plan?.queued && parts.length) {
    return `Queued ${joinWords(parts)}`;
  }
  if (rules?.newReleases) return "Watching for new releases";
  return "Nothing new to download";
}
