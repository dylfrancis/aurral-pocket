import {
  isAlbumRequest,
  type ActivityItem,
  type ActivitySource,
} from "@/lib/types/activity";

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

export const DEFAULT_ACTIVITY_VIEW: ActivityView = "queue";

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

/**
 * Re-searchable failures float to the top — they are the only history rows the
 * user can act on. Otherwise newest first, with id as a stable tiebreak.
 */
export function compareActivityItems(a: ActivityItem, b: ActivityItem): number {
  const aReSearch = canReSearch(a) ? 1 : 0;
  const bReSearch = canReSearch(b) ? 1 : 0;
  if (aReSearch !== bReSearch) return bReSearch - aReSearch;

  const delta =
    new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
  if (delta) return delta;
  return String(b.id ?? "").localeCompare(String(a.id ?? ""));
}

/**
 * Aurral computes this itself for history entries (album_requested + failed +
 * has an albumId). Album requests never carry the flag, so fall back to the
 * equivalent condition for them.
 */
export function canReSearch(item: ActivityItem): boolean {
  if (isAlbumRequest(item)) {
    return item.status === "failed" && !!item.albumId;
  }
  return item.canReSearch === true;
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
      if (!isAlbumRequest(item)) {
        if (item.upgrade) return "upgraded";
        if (item.kind === "track_download") return "downloaded";
      }
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
  if (isAlbumRequest(item) || !item.upgrade) return null;
  const { fromQuality } = item.upgrade;
  return fromQuality ? `Upgrade from ${fromQuality}` : "Quality upgrade";
}

// Aurral's own names for its download clients. Lidarr and Aurral say who
// manages an entry, not where a file came from, so they get none.
const SOURCE_LABELS: Partial<Record<ActivitySource, string>> = {
  slskd: "slskd",
  nzbget: "NZBGet",
  sabnzbd: "SABnzbd",
  tidarr: "Tidarr",
  ytdlp: "yt-dlp",
  deemix: "deemix",
  share: "Aurral share",
};

export function activitySourceLabel(item: ActivityItem): string | null {
  if (isAlbumRequest(item)) return null;
  return SOURCE_LABELS[item.source] ?? null;
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
  if (isAlbumRequest(item)) return filter === "requests";

  switch (filter) {
    case "requests":
      return item.kind === "album_requested";
    case "downloads":
      return (
        item.kind === "track_download" ||
        item.kind === "track_reused_lidarr" ||
        item.kind === "missing_track_search"
      );
    case "library":
      return item.kind === "artist_added";
    default:
      return true;
  }
}
