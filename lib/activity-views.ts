import type { ActivityItem } from "@/lib/types/activity";

/**
 * Mirrors Aurral's own activity segmentation (navigation/activityNavConfig.ts)
 * so Pocket and the web UI put the same item in the same bucket. Pocket keeps
 * blocked jobs in a Review view of their own, where the web lists them in
 * Queue.
 */
export const ACTIVITY_VIEWS = [
  { id: "queue", label: "Queue" },
  { id: "review", label: "Review" },
  { id: "history", label: "History" },
] as const;

export type ActivityView = (typeof ACTIVITY_VIEWS)[number]["id"];

export function isQueueItem(item: ActivityItem): boolean {
  if (item.status === "blocked") return false;
  return (
    item.inQueue === true ||
    item.status === "processing" ||
    item.status === "pending"
  );
}

export function matchesActivityView(
  item: ActivityItem,
  view: ActivityView,
): boolean {
  if (view === "queue") return isQueueItem(item);
  if (view === "review") return item.status === "blocked";
  return !isQueueItem(item) && item.status !== "blocked";
}

/** Newest first, with id as a stable tiebreak. */
export function compareActivityItems(a: ActivityItem, b: ActivityItem): number {
  const delta =
    new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
  if (delta) return delta;
  return String(b.id ?? "").localeCompare(String(a.id ?? ""));
}

const ACTIVITY_STATUS_LABELS = {
  searching: "Searching",
  downloading: "Downloading",
  queued: "Queued",
  downloaded: "Downloaded",
  upgraded: "Upgraded",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

export type ActivityStatus = keyof typeof ACTIVITY_STATUS_LABELS;

const VIEW_STATUSES: Partial<Record<ActivityView, readonly ActivityStatus[]>> =
  {
    queue: ["searching", "downloading", "queued", "failed"],
    history: ["downloaded", "upgraded", "failed", "cancelled"],
  };

/**
 * The web's status buckets, read off the status and its label because the API
 * sends none. A job being cancelled, or an entry that downloaded nothing such
 * as an added artist, falls in none.
 */
export function getActivityStatus(item: ActivityItem): ActivityStatus | null {
  const label = item.statusLabel ?? "";
  switch (item.status) {
    case "pending":
      return "queued";
    case "processing":
      if (/queued/i.test(label)) return "queued";
      if (/search|requested/i.test(label)) return "searching";
      if (/download|waiting|moving|processing/i.test(label)) {
        return "downloading";
      }
      return null;
    case "completed":
    case "available":
      if (item.upgrade) return "upgraded";
      if (item.kind === "track_download") return "downloaded";
      return label === "Downloaded" ? "downloaded" : null;
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

export type ActivityStatusOption = {
  id: ActivityStatus;
  label: string;
  count: number;
};

export function getActivityStatusOptions(
  view: ActivityView,
  items: readonly ActivityItem[],
  selected: ActivityStatus | null,
): ActivityStatusOption[] {
  const counts = new Map<ActivityStatus, number>();
  for (const item of items) {
    const status = getActivityStatus(item);
    if (status) counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return (VIEW_STATUSES[view] ?? [])
    .map((id) => ({
      id,
      label: ACTIVITY_STATUS_LABELS[id],
      count: counts.get(id) ?? 0,
    }))
    .filter(
      (option) =>
        view !== "queue" || option.count > 0 || option.id === selected,
    );
}

export function activityUpgradeLabel(item: ActivityItem): string | null {
  if (!item.upgrade) return null;
  const { fromQuality } = item.upgrade;
  return fromQuality ? `Upgrade from ${fromQuality}` : "Quality upgrade";
}

// Aurral's own names for its download clients. Lidarr and Aurral say who
// manages an entry, not where a file came from, so they get none.
const SOURCE_LABELS = new Map([
  ["slskd", "slskd"],
  ["usenet", "Usenet"],
  ["nzbget", "NZBGet"],
  ["sabnzbd", "SABnzbd"],
  ["tidarr", "Tidarr"],
  ["ytdlp", "yt-dlp"],
  ["deemix", "deemix"],
  ["qbittorrent", "qBittorrent"],
  ["share", "Aurral share"],
]);

const PLUGIN_SOURCE_PREFIX = "plugin:";

function downloadSourceLabel(source: string | null | undefined) {
  if (!source) return null;
  if (source.startsWith(PLUGIN_SOURCE_PREFIX)) {
    const pluginId = source.slice(PLUGIN_SOURCE_PREFIX.length).trim();
    return pluginId ? `${pluginId} plugin` : null;
  }
  return SOURCE_LABELS.get(source) ?? null;
}

/**
 * Aurral reads a plugin download as "unknown", so a track of an album download
 * falls back to the source Aurral recorded for it.
 */
export function activitySourceLabel(item: ActivityItem): string | null {
  return downloadSourceLabel(
    item.source === "unknown" ? item.actualDownloadSource : item.source,
  );
}

/** Counts per view, from the unfiltered feed, for the tab labels. */
export function getActivityCounts(
  items: ActivityItem[] | undefined,
): Record<ActivityView, number> {
  const feed = items ?? [];
  return {
    queue: feed.filter((item) => matchesActivityView(item, "queue")).length,
    review: feed.filter((item) => matchesActivityView(item, "review")).length,
    history: feed.filter((item) => matchesActivityView(item, "history")).length,
  };
}

export const ACTIVITY_EMPTY_STATES: Record<
  ActivityView,
  { message: string; hint: string }
> = {
  queue: {
    message: "Queue is empty",
    hint: "Active album requests and downloads appear here.",
  },
  review: {
    message: "No tracks to review",
    hint: "Downloaded tracks that need your approval appear here.",
  },
  history: {
    message: "No activity yet",
    hint: "A log of album requests, downloads, and library changes appears here.",
  },
};

/** Secondary filter, applied within a view. */
export const ACTIVITY_TYPES = [
  { id: "all", label: "All" },
  { id: "requests", label: "Requests" },
  { id: "downloads", label: "Downloads" },
  { id: "library", label: "Library" },
] as const;

export type ActivityTypeFilter = (typeof ACTIVITY_TYPES)[number]["id"];

export function matchesActivityType(
  item: ActivityItem,
  filter: ActivityTypeFilter,
): boolean {
  if (filter === "all") return true;
  switch (filter) {
    case "requests":
      return item.kind === "album_requested";
    case "downloads":
      return (
        item.kind === "track_download" || item.kind === "missing_track_search"
      );
    case "library":
      return item.kind === "artist_added";
    default:
      return true;
  }
}
