import type { SaveStatus } from "@/lib/offline/saved-library";

/** Decimal units, as both platforms show storage: "412 MB", "1.2 GB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${shortNumber(bytes / 1e9)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${Math.max(0, Math.round(bytes))} bytes`;
}

function shortNumber(value: number): string {
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

/** The line under a hero while an item saves. Null once it's all saved. */
export function saveStatusLine(status: SaveStatus | null): string | null {
  if (!status) return null;
  const { state, saved, total, failed } = status;
  if (state === "saved") return null;
  // Not "Saving 0 of 1".
  if (status.item.kind === "song") {
    if (state === "incomplete") return "Couldn’t be saved";
    return state === "waiting" ? "Waiting to save" : "Saving…";
  }
  if (state === "incomplete") {
    return failed === 1
      ? "1 track couldn’t be saved"
      : `${failed} tracks couldn’t be saved`;
  }
  if (state === "waiting") return `Waiting to save · ${saved} of ${total}`;
  return `Saving ${saved} of ${total}`;
}
