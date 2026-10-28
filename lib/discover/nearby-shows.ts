import type {
  NearbyShowsDateRange,
  NearbyShowsSort,
  NearbyShowsSource,
} from "@/components/discover/NearbyShowsFilterSheet";
import {
  isInNext30Days,
  isInThisWeekend,
  parseShowDate,
} from "@/lib/discover/show-dates";
import type { ConcertEvent } from "@/lib/types/search";

export type NearbyShowsFilters = {
  source: NearbyShowsSource;
  dateRange: NearbyShowsDateRange;
  query: string;
  sort: NearbyShowsSort;
};

export function formatShowArtists(show: ConcertEvent): string {
  return show.artistNames.join(", ");
}

function withinDateRange(
  show: ConcertEvent,
  range: NearbyShowsDateRange,
): boolean {
  if (range === "all") return true;
  const date = parseShowDate(show);
  if (!date) return false;
  return range === "weekend" ? isInThisWeekend(date) : isInNext30Days(date);
}

function matchesSource(show: ConcertEvent, source: NearbyShowsSource): boolean {
  if (source === "all") return true;
  return show.sourceTypes.includes(source);
}

function matchesQuery(show: ConcertEvent, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    show.artistNames.some((name) => name.toLowerCase().includes(q)) ||
    (show.eventName ? show.eventName.toLowerCase().includes(q) : false)
  );
}

function compareShows(a: ConcertEvent, b: ConcertEvent, sort: NearbyShowsSort) {
  switch (sort) {
    case "distance": {
      const aDist = Number.isFinite(a.distance)
        ? (a.distance as number)
        : Number.POSITIVE_INFINITY;
      const bDist = Number.isFinite(b.distance)
        ? (b.distance as number)
        : Number.POSITIVE_INFINITY;
      if (aDist !== bDist) return aDist - bDist;
      return (a.dateTime || a.date || "").localeCompare(
        b.dateTime || b.date || "",
      );
    }
    case "artist":
      return (a.artistNames[0] ?? "").localeCompare(
        b.artistNames[0] ?? "",
        undefined,
        { sensitivity: "base" },
      );
    case "date":
    default: {
      const aTime = a.dateTime || a.date || "";
      const bTime = b.dateTime || b.date || "";
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      const aDist = Number.isFinite(a.distance)
        ? (a.distance as number)
        : Number.POSITIVE_INFINITY;
      const bDist = Number.isFinite(b.distance)
        ? (b.distance as number)
        : Number.POSITIVE_INFINITY;
      return aDist - bDist;
    }
  }
}

export function filterNearbyShows(
  shows: ConcertEvent[],
  { source, dateRange, query, sort }: NearbyShowsFilters,
): ConcertEvent[] {
  return shows
    .filter((s) => matchesSource(s, source))
    .filter((s) => withinDateRange(s, dateRange))
    .filter((s) => matchesQuery(s, query))
    .sort((a, b) => compareShows(a, b, sort));
}
