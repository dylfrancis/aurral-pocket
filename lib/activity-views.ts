import { formatDate, formatTime } from "@/lib/date-time";
import { isActiveAurralStatus } from "@/lib/album-status";
import type { DownloadStatusValue } from "@/lib/types/library";
import type {
  ActivityCauseGroup,
  ActivityItem,
  ActivityStatus,
} from "@/lib/types/activity";
import { albumRequestLibraryId } from "@/lib/types/activity";

/**
 * Aurral's Queue and History, plus a Review view of its own for the tracks
 * awaiting review, which the web lists only under Queue's Review filter.
 */
export const ACTIVITY_VIEWS = [
  { id: "queue", label: "Queue" },
  { id: "review", label: "Review" },
  { id: "history", label: "History" },
] as const;

export type ActivityView = (typeof ACTIVITY_VIEWS)[number]["id"];

/**
 * The page each view reads. Aurral keeps tracks awaiting review in its queue,
 * so Review is the queue filtered to them.
 */
export function activityPageFilter(view: ActivityView): {
  view: "queue" | "history";
  status: ActivityStatus | null;
} {
  if (view === "review") return { view: "queue", status: "review" };
  return { view, status: null };
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

/** Names a cause group the way the web's Activity does. */
export function describeActivityCause(group: ActivityCauseGroup): {
  title: string;
  why: string | null;
} {
  switch (group.kind) {
    case "upgrade":
      return { title: "Quality upgrades", why: "below your quality cutoff" };
    case "flow":
      return { title: group.name ?? "Flow", why: "flow refresh" };
    case "playlist":
      return {
        title: group.name ?? "Playlist",
        why: group.syncedFrom
          ? `synced from ${group.syncedFrom}`
          : "added to the playlist",
      };
    case "missing": {
      const albums = causeSubjects(group, "album");
      return {
        title: "Missing tracks",
        why: albums && `searching again on ${albums}`,
      };
    }
    case "monitoring": {
      const artists = causeSubjects(group, "artist");
      return {
        title: "Artist monitoring",
        why: artists && `new music from ${artists}`,
      };
    }
    case "request":
      return { title: "Requests", why: null };
    case "share":
      return { title: "Share links", why: "music shared with you" };
    default:
      return { title: "Other", why: null };
  }
}

function causeSubjects(group: ActivityCauseGroup, noun: string) {
  if (group.subject) return group.subject;
  return group.subjects && group.subjects > 1
    ? `${group.subjects} ${noun}s`
    : null;
}

/** A time today, a date otherwise. */
export function formatCauseSince(since: string, now = new Date()) {
  const date = new Date(since);
  if (Number.isNaN(date.getTime())) return null;
  return date.toDateString() === now.toDateString()
    ? formatTime(date, { hour: "numeric", minute: "2-digit" })
    : formatDate(date, { month: "short", day: "numeric" });
}

/**
 * The Library album that Stop Download cancels, while it still downloads.
 * Aurral marks an album request completed at once, so a request asks the
 * album's download status; an album download's own status is live.
 */
export function stoppableAlbumId(
  item: ActivityItem,
  downloadStatus: DownloadStatusValue | undefined,
): string | null {
  if (item.kind === "album_download") {
    return item.inQueue ? item.libraryAlbumId : null;
  }
  const albumId = albumRequestLibraryId(item);
  return albumId && isActiveAurralStatus(downloadStatus) ? albumId : null;
}
