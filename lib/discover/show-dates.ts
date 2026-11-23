import {
  addDays,
  endOfDay,
  getDay,
  isWithinInterval,
  startOfDay,
} from "date-fns";
import { formatDate, formatTime } from "@/lib/date-time";
import type { ConcertEvent } from "@/lib/types/search";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

function parseDateValue(value?: string | null): Date | null {
  if (!value) return null;
  const dateOnly = value.match(DATE_ONLY_PATTERN);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The day the show is on. `date` is the venue's own calendar day; `dateTime`
 * is UTC, so a late show reads as the next day east of the venue.
 */
export function getShowDay(show: ConcertEvent): Date | null {
  return parseDateValue(show.date) || parseDateValue(show.dateTime);
}

/** Ticketmaster's venue-local "19:00:00", in the server's time format. */
export function formatShowTime(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(TIME_PATTERN);
  if (!match) return value;
  const [, hour, minute] = match;
  return formatTime(new Date(2000, 0, 1, Number(hour), Number(minute)), {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Nov 28, 2026 at 7:00 PM", as the web writes it. */
export function formatShowDateLabel(show: ConcertEvent): string | null {
  if (!show.date && !show.dateTime) return null;
  const day = getShowDay(show);
  if (!day) return show.date || null;
  const dateLabel = formatDate(day, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = formatShowTime(show.time);
  return time ? `${dateLabel} at ${time}` : dateLabel;
}

/**
 * The month heading a show sits under. The web names the month alone; the
 * year is added outside the current one so January after December reads right.
 */
export function showMonthLabel(
  show: ConcertEvent,
  now: Date = new Date(),
): string {
  const day = getShowDay(show);
  if (!day) return "Date to be announced";
  return day.toLocaleDateString(
    undefined,
    day.getFullYear() === now.getFullYear()
      ? { month: "long" }
      : { month: "long", year: "numeric" },
  );
}

export function isInThisWeekend(date: Date, now: Date = new Date()): boolean {
  const dow = getDay(date);
  if (dow !== 0 && dow !== 6) return false;
  return isWithinInterval(date, {
    start: startOfDay(now),
    end: endOfDay(addDays(now, 7)),
  });
}

export function isInNext30Days(date: Date, now: Date = new Date()): boolean {
  return isWithinInterval(date, {
    start: startOfDay(now),
    end: endOfDay(addDays(now, 30)),
  });
}
