/**
 * Date and time formats the server offers under Settings → System. The server
 * sends the active one in the `/health` bootstrap payload as `dateTimeFormat`.
 */
export const DATE_TIME_FORMATS = [
  "browser",
  "day-first",
  "year-first",
] as const;

export type DateTimeFormat = (typeof DATE_TIME_FORMATS)[number];
