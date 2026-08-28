import { useSyncExternalStore } from "react";
import { getDateTimeFormat, subscribeToDateTimeFormat } from "@/lib/date-time";
import type { DateTimeFormat } from "@/lib/types/date-time";

/**
 * Subscribes a component to the server's date and time format. Call it in any
 * component that renders a date, so a changed server setting repaints it. Most
 * callers ignore the return value: the formatting functions in `lib/date-time`
 * read the same store.
 */
export function useDateTimeFormat(): DateTimeFormat {
  return useSyncExternalStore(
    subscribeToDateTimeFormat,
    getDateTimeFormat,
    getDateTimeFormat,
  );
}
