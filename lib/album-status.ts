import { formatDate } from "@/lib/date-time";
import type { DownloadStatusMap } from "@/lib/types/library";

const AURRAL_ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "downloading",
]);

/**
 * Aurral's other album statuses change only on a user action or on the
 * release date, so polling stops at them, as on the web.
 */
export function hasActiveAurralStatus(statuses: DownloadStatusMap | undefined) {
  return Object.entries(statuses ?? {}).some(
    ([key, entry]) =>
      key.startsWith("aurral:") && AURRAL_ACTIVE_STATUSES.has(entry.status),
  );
}

export function isActiveAurralStatus(status: string | undefined) {
  return !!status && AURRAL_ACTIVE_STATUSES.has(status);
}

/**
 * Compares UTC calendar days, as Aurral does, so a bare year reads as
 * unreleased only while that year is still to come.
 */
export function isUnreleased(
  releaseDate: string | null | undefined,
  now = Date.now(),
) {
  const day = String(releaseDate ?? "")
    .trim()
    .slice(0, 10);
  return /^\d{4}/.test(day) && day > new Date(now).toISOString().slice(0, 10);
}

/**
 * Aurral answers a status for every album it manages, so none means it hasn't
 * answered yet. Nothing new starts while tracks are in flight or wait on a
 * review or a download source. Monitoring an album queues every missing
 * track. A monitored album that reads complete is missing only tracks someone
 * unmonitored, and an unreleased one downloads on its own.
 */
export function canResearchAurralAlbum(
  album: { monitored: boolean },
  status: string | undefined,
) {
  if (!status) return false;
  if (isActiveAurralStatus(status) || status === "blocked") return false;
  if (!album.monitored) return true;
  return status !== "complete" && status !== "unreleased";
}

/**
 * A scanned album often carries only its tag's year, and Date reads a bare
 * "2027" as UTC midnight, the last day of 2026 west of Greenwich, so a
 * partial date names only what it has.
 */
export function formatReleaseWait(releaseDate: string | null | undefined) {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(releaseDate ?? "");
  if (!match) return "Downloads when it's out";
  const [, year, month, day] = match;
  if (!month) return `Downloads in ${year}`;
  const date = new Date(Number(year), Number(month) - 1, Number(day ?? 1));
  if (!day) {
    return `Downloads in ${date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })}`;
  }
  return `Downloads ${formatDate(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}
