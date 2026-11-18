export type MonitoringCatalog = "all" | "since" | "latest" | "none";

export type MonitoringEdition = "standard" | "expanded";

export type MonitoringRules = {
  catalog: MonitoringCatalog;
  /** The server nulls it unless the catalogue is "since". */
  sinceYear: number | null;
  latestCount: number;
  newReleases: boolean;
  /** Primary types: album, ep and single. */
  types: string[];
  /** Secondary types a release may also have, such as live. */
  extraTypes: string[];
  edition: MonitoringEdition;
  /** Popular songs missing from the chosen releases. */
  topTracks: number;
};

/** Body of `GET /library/artists/:mbid/monitoring`. */
export type ArtistMonitoringState = {
  added: boolean;
  monitored: boolean;
  /** True for an unmonitored artist too. */
  useDefault: boolean;
  /** The rules in force, which are the defaults when `useDefault`. Null when unmonitored. */
  rules: MonitoringRules | null;
  defaultRules: MonitoringRules;
};

/** Body of `GET /library/monitoring/defaults`. */
export type MonitoringDefaults = {
  rules: MonitoringRules;
  updatedAt: number | null;
  /** Artists that follow the defaults. */
  artistCount: number;
};

/** What starting to monitor an artist did, as far as pocket reads it. */
export type MonitoringPlan = {
  queued: boolean;
  releaseGroupIds: string[];
  topTracks: unknown[];
};

/**
 * `useDefault` follows the server's default rules, including later changes to
 * them. An unmonitored artist is still added, and nothing downloads.
 */
export type ArtistMonitoring =
  | { monitored: true; useDefault: true }
  | { monitored: true; useDefault: false; rules: MonitoringRules }
  | { monitored: false };

/**
 * What `PUT /library/artists/:mbid` answers, as far as pocket reads it. The
 * rule fields and the plan are missing when an artist Aurral doesn't manage
 * is left unmonitored.
 */
export type ArtistMonitoringChange = {
  monitored: boolean;
  useDefault?: boolean;
  rules?: MonitoringRules | null;
  defaultRules?: MonitoringRules;
  monitoring?: MonitoringPlan;
};
