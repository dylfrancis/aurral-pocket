import type {
  NearbyShowsDateRange,
  NearbyShowsSource,
} from "@/components/discover/NearbyShowsFilterSheet";
import {
  getShowDay,
  isInNext30Days,
  isInThisWeekend,
  showMonthLabel,
} from "@/lib/discover/show-dates";
import type { ConcertEvent, NearbyShowsLocation } from "@/lib/types/search";

export type NearbyShowsFilters = {
  source: NearbyShowsSource;
  dateRange: NearbyShowsDateRange;
  query: string;
};

/** The Shows page lists this many after filtering, as the web does. */
export const SHOWS_PAGE_LIMIT = 60;

const MIN_SHELF_ITEMS = 3;
const MAX_SHELF_ITEMS = 8;

export function formatShowArtists(show: ConcertEvent): string {
  return show.artistNames.filter(Boolean).join(", ");
}

/** The event's own name, falling back to who plays it. */
export function showTitle(show: ConcertEvent): string {
  return show.eventName || formatShowArtists(show) || "Upcoming show";
}

/** Whether the title already names every artist, so a byline would repeat it. */
export function titleNamesArtists(title: string, artistNames: string[]) {
  const normalizedTitle = title.toLocaleLowerCase();
  return (
    artistNames.length > 0 &&
    artistNames.every((name) =>
      normalizedTitle.includes(name.toLocaleLowerCase()),
    )
  );
}

export function formatDistance(distance?: number | null): string | null {
  return typeof distance === "number" && Number.isFinite(distance)
    ? `${Math.round(distance)} mi`
    : null;
}

/** The ticket link, only when it's a web address. */
export function getEventUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

export const joinMeta = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(" · ");

/** The web's short location name: the city, else the label's first part. */
export function nearbyCityLabel(
  location: NearbyShowsLocation | null | undefined,
): string {
  if (!location) return "Location";
  if (location.city) return location.city;
  const first = location.label?.split(",")[0]?.trim();
  return first || location.postalCode || "Location";
}

/** Pocket can't set the key, so admins are sent to the web's settings. */
export function ticketmasterSetupMessage(canManageServer: boolean) {
  return canManageServer
    ? "Add a Ticketmaster key in Aurral's web Settings → Discovery to find nearby shows."
    : "An admin needs to add a Ticketmaster key to find nearby shows.";
}

function withinDateRange(
  show: ConcertEvent,
  range: NearbyShowsDateRange,
): boolean {
  if (range === "all") return true;
  const day = getShowDay(show);
  if (!day) return false;
  return range === "weekend" ? isInThisWeekend(day) : isInNext30Days(day);
}

// The web's Discover filter takes every show matched through anything but the
// Library: recommended and trending artists alike.
function matchesSource(show: ConcertEvent, source: NearbyShowsSource): boolean {
  if (source === "library") return show.sourceTypes.includes("library");
  if (source === "discover") {
    return show.sourceTypes.some((sourceType) => sourceType !== "library");
  }
  return true;
}

function matchesQuery(show: ConcertEvent, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    show.artistNames.some((name) => name.toLowerCase().includes(q)) ||
    (show.eventName ? show.eventName.toLowerCase().includes(q) : false)
  );
}

/** Keeps the server's order: by date, then nearest first. */
export function filterNearbyShows(
  shows: ConcertEvent[],
  { source, dateRange, query }: NearbyShowsFilters,
): ConcertEvent[] {
  return shows.filter(
    (show) =>
      matchesSource(show, source) &&
      withinDateRange(show, dateRange) &&
      matchesQuery(show, query),
  );
}

export type ShowMonthGroup = { label: string; shows: ConcertEvent[] };

/** Splits shows into the web's lead, Coming Up shelf and month groups. */
export function splitShowFeed(shows: ConcertEvent[], now: Date = new Date()) {
  const [lead, ...rest] = shows;
  const shelf =
    rest.length >= MIN_SHELF_ITEMS ? rest.slice(0, MAX_SHELF_ITEMS) : [];
  const groups: ShowMonthGroup[] = [];
  for (const show of rest.slice(shelf.length)) {
    const label = showMonthLabel(show, now);
    const last = groups.at(-1);
    if (last?.label === label) last.shows.push(show);
    else groups.push({ label, shows: [show] });
  }
  return { lead, shelf, groups };
}
