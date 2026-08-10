import { isAlbumRequest, type ActivityItem } from "@/lib/types/activity";

/**
 * Mirrors Aurral's own activity segmentation (navigation/activityNavConfig.js)
 * so Pocket and the web UI put the same item in the same bucket. Blocked is
 * checked first in both: a blocked job is awaiting a decision, not queued.
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
        item.kind === "track_download" || item.kind === "track_reused_lidarr"
      );
    case "library":
      return item.kind === "artist_added";
    default:
      return true;
  }
}
