import { z } from "zod";

export type HeaderRow = { id: string; name: string; value: string };

// Narrower than RFC 9110's token characters, which also allow symbols such as
// `!` and `|` that no real proxy header uses.
const HEADER_NAME_PATTERN = /^[0-9A-Za-z_-]+$/;
// A line break would let a value start a header of its own.
const HEADER_VALUE_PATTERN = /^[\t\x20-\x7e]*$/;

// Pocket or the HTTP stack sets these, so a custom one would replace the
// session token or break the request.
const RESERVED_NAMES = new Set([
  "authorization",
  "content-type",
  "accept",
  "range",
  "host",
  "content-length",
]);

let nextRowId = 0;

export function newHeaderRow(name = "", value = ""): HeaderRow {
  nextRowId += 1;
  return { id: `header-${nextRowId}`, name, value };
}

/** With no headers, one blank row, so the editor opens ready to type. */
export function headersToRows(headers: Record<string, string>): HeaderRow[] {
  const rows = Object.entries(headers).map(([name, value]) =>
    newHeaderRow(name, value),
  );
  return rows.length > 0 ? rows : [newHeaderRow()];
}

function isBlank(row: HeaderRow) {
  return !row.name.trim() && !row.value.trim();
}

export function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  return Object.fromEntries(
    rows
      .filter((row) => !isBlank(row))
      .map((row) => [row.name.trim(), row.value.trim()]),
  );
}

export const headerRowsSchema = z
  .array(z.object({ id: z.string(), name: z.string(), value: z.string() }))
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      if (isBlank(row)) return;
      const name = row.name.trim();
      const value = row.value.trim();
      const flag = (field: "name" | "value", message: string) =>
        ctx.addIssue({ code: "custom", path: [index, field], message });

      if (!name) {
        flag("name", "Add a header name.");
        return;
      }
      if (!HEADER_NAME_PATTERN.test(name)) {
        flag(
          "name",
          "Use only letters, numbers, dashes and underscores in a header name.",
        );
        return;
      }
      if (RESERVED_NAMES.has(name.toLowerCase())) {
        flag("name", `Aurral Pocket sets ${name} itself.`);
        return;
      }
      if (seen.has(name.toLowerCase())) {
        flag("name", `${name} is already in the list.`);
        return;
      }
      seen.add(name.toLowerCase());

      if (!value) {
        flag("value", `Add a value for ${name}.`);
        return;
      }
      if (!HEADER_VALUE_PATTERN.test(value)) {
        flag("value", "Remove line breaks and special characters.");
      }
    });
  });
