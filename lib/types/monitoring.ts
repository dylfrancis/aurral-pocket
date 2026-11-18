/** Which releases already out monitoring downloads. */
export type MonitoringCatalog = "all" | "since" | "latest" | "none";

export type MonitoringEdition = "standard" | "expanded";

/** Aurral's rules for what monitoring an artist downloads. */
export type MonitoringRules = {
  catalog: MonitoringCatalog;
  /** The first year a "since" catalogue takes. The server nulls it otherwise. */
  sinceYear: number | null;
  /** How many releases a "latest" catalogue takes. */
  latestCount: number;
  /** Downloads matching releases when they come out. */
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
  /** False when the artist isn't in the Library. */
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
  /** True when the downloads were handed to the queue. */
  queued: boolean;
  releaseGroupIds: string[];
  topTracks: unknown[];
};

/**
 * Sent as `monitoring` when adding an artist or changing its monitoring.
 * `useDefault` follows the server's default rules, including later changes to
 * them. An unmonitored artist is added and nothing downloads.
 */
export type ArtistMonitoring =
  | { monitored: true; useDefault: true }
  | { monitored: true; useDefault: false; rules: MonitoringRules }
  | { monitored: false };

/**
 * What `PUT /library/artists/:mbid` answers, as far as pocket reads it. The
 * rule fields and the plan are missing when an artist that was never
 * monitored is left unmonitored.
 */
export type ArtistMonitoringChange = {
  monitored: boolean;
  useDefault?: boolean;
  rules?: MonitoringRules | null;
  defaultRules?: MonitoringRules;
  monitoring?: MonitoringPlan;
};
