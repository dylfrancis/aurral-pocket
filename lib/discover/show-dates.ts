import {
  addDays,
  endOfDay,
  format,
  getDay,
  isValid,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import type { ConcertEvent } from "@/lib/types/search";

export function parseShowDate(show: ConcertEvent): Date | null {
  const raw = show.dateTime || show.date || "";
  if (!raw) return null;
  const parsed = parseISO(raw);
  return isValid(parsed) ? parsed : null;
}

export function formatShowDateLabel(show: ConcertEvent): string | null {
  const parsed = parseShowDate(show);
  if (!parsed) return show.date || null;
  const dateLabel = format(parsed, "MMM d, yyyy");
  return show.time ? `${dateLabel} at ${show.time}` : dateLabel;
}

export function formatShowTime(show: ConcertEvent): string | null {
  if (show.time) return show.time;
  if (!show.dateTime) return null;
  const parsed = parseShowDate(show);
  return parsed ? format(parsed, "p") : null;
}

export function formatCalendarTile(date: Date) {
  return {
    month: format(date, "MMM").toUpperCase(),
    day: format(date, "d"),
    weekday: format(date, "EEE").toUpperCase(),
  };
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
