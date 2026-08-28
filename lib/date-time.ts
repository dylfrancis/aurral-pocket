import { AppStorage } from "@/lib/storage";
import { DATE_TIME_FORMATS } from "@/lib/types/date-time";
import type { DateTimeFormat } from "@/lib/types/date-time";

/**
 * The server's date and time format, mirrored on the device.
 *
 * The server owns this setting and sends it with every `/health` response. The
 * value lives in a module store rather than React state because most callers
 * are plain formatting functions, not components. Components that render a date
 * subscribe through `useDateTimeFormat` so a changed setting repaints them.
 *
 * `browser` means "use the device locale", which is what pocket did before the
 * server had this setting. The other two formats are explicit and ignore the
 * locale, the same way the Aurral web client renders them.
 */

let currentFormat: DateTimeFormat = "browser";
const listeners = new Set<() => void>();

export function normalizeDateTimeFormat(value: unknown): DateTimeFormat {
  return DATE_TIME_FORMATS.includes(value as DateTimeFormat)
    ? (value as DateTimeFormat)
    : "browser";
}

export function getDateTimeFormat(): DateTimeFormat {
  return currentFormat;
}

export function subscribeToDateTimeFormat(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function apply(value: unknown): boolean {
  const next = normalizeDateTimeFormat(value);
  if (next === currentFormat) return false;
  currentFormat = next;
  listeners.forEach((listener) => listener());
  return true;
}

/** Adopts the format from a server response and remembers it for next launch. */
export function setDateTimeFormat(value: unknown): void {
  const next = normalizeDateTimeFormat(value);
  apply(next);
  void AppStorage.setDateTimeFormat(next);
}

/**
 * Loads the last known format. Startup calls this so the first frame after a
 * cold launch already renders dates the server's way, before `/health` answers.
 */
export async function restoreDateTimeFormat(): Promise<void> {
  const stored = await AppStorage.getDateTimeFormat();
  if (stored) apply(stored);
}

/** Drops the remembered format when the user disconnects from the server. */
export async function forgetDateTimeFormat(): Promise<void> {
  apply("browser");
  await AppStorage.deleteDateTimeFormat();
}

const pad = (value: number) => String(value).padStart(2, "0");

function isUtc(options?: Intl.DateTimeFormatOptions) {
  return options?.timeZone === "UTC";
}

export function formatDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (currentFormat === "browser" || Number.isNaN(date.getTime())) {
    return date.toLocaleDateString(undefined, options);
  }
  const utc = isUtc(options);
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  const month = pad((utc ? date.getUTCMonth() : date.getMonth()) + 1);
  const day = pad(utc ? date.getUTCDate() : date.getDate());
  return currentFormat === "day-first"
    ? `${day}/${month}/${year}`
    : `${year}/${month}/${day}`;
}

export function formatTime(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (currentFormat === "browser" || Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString(undefined, options);
  }
  const utc = isUtc(options);
  const hours = pad(utc ? date.getUTCHours() : date.getHours());
  const minutes = pad(utc ? date.getUTCMinutes() : date.getMinutes());
  return `${hours}:${minutes}`;
}

export function formatDateTime(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (currentFormat === "browser" || Number.isNaN(date.getTime())) {
    return date.toLocaleString(undefined, options);
  }
  const datePart = formatDate(date, options);
  const timePart = formatTime(date, options);
  return currentFormat === "day-first"
    ? `${timePart} ${datePart}`
    : `${datePart} ${timePart}`;
}
