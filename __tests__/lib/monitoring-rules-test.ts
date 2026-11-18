import { describeMonitoringRules } from "@/lib/monitoring-rules";
import type { MonitoringRules } from "@/lib/types/monitoring";

const RULES: MonitoringRules = {
  catalog: "all",
  sinceYear: null,
  latestCount: 1,
  newReleases: true,
  types: ["album", "ep"],
  extraTypes: [],
  edition: "standard",
  topTracks: 0,
};

describe("describeMonitoringRules", () => {
  // The web's wording (frontend/src/utils/monitoringRules.ts), except that
  // "DJ mixes" keeps its capitals mid-sentence.
  it.each<[string, Partial<MonitoringRules>, string]>([
    ["the defaults", {}, "Everything and new releases · Albums and EPs"],
    [
      "a year with extra types",
      {
        catalog: "since",
        sinceYear: 2010,
        newReleases: false,
        extraTypes: ["live", "dj-mix"],
      },
      "Everything since 2010 · Albums and EPs, including live and DJ mixes",
    ],
    [
      "the latest few, top tracks and expanded editions",
      {
        catalog: "latest",
        latestCount: 3,
        types: ["album", "ep", "single"],
        topTracks: 5,
        edition: "expanded",
      },
      "The latest 3 releases and new releases · Albums, EPs and Singles · Top 5 tracks · Expanded editions",
    ],
    [
      "top tracks alone",
      { catalog: "none", newReleases: false, topTracks: 1 },
      "Top 1 track",
    ],
  ])("sums up %s", (_case, rules, summary) => {
    expect(describeMonitoringRules({ ...RULES, ...rules })).toBe(summary);
  });
});
