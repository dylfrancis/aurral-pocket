import type {
  Album,
  PrimaryReleaseType,
  SecondaryReleaseType,
} from "@/lib/types/library";
import { useCallback, useMemo, useState } from "react";

export const PRIMARY_TYPES: PrimaryReleaseType[] = [
  "Album",
  "EP",
  "Single",
  "Broadcast",
  "Other",
];
export const SECONDARY_TYPES: SecondaryReleaseType[] = [
  "Live",
  "Remix",
  "Compilation",
  "Demo",
  "Broadcast",
  "Soundtrack",
  "Spokenword",
  "Other",
];
const ALL_TYPES: string[] = [...PRIMARY_TYPES, ...SECONDARY_TYPES];

export function matchesFilter(album: Album, selected: Set<string>): boolean {
  if (selected.size === ALL_TYPES.length) return true;
  const primary = album.albumType ?? "Album";
  if (!selected.has(primary)) return false;
  const secondary = album.secondaryTypes ?? [];
  if (secondary.length > 0) {
    return secondary.every((t) =>
      selected.has(SECONDARY_TYPES.includes(t) ? t : "Other"),
    );
  }
  return true;
}

export function useReleaseTypeFilter() {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(ALL_TYPES),
  );

  const toggleSecondary = useCallback((type: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(ALL_TYPES)), []);
  const clearSecondary = useCallback(
    () => setSelected(new Set(PRIMARY_TYPES)),
    [],
  );

  const activeSecondaryCount = useMemo(
    () => SECONDARY_TYPES.filter((t) => !selected.has(t)).length,
    [selected],
  );

  return {
    selected,
    toggleSecondary,
    selectAll,
    clearSecondary,
    activeSecondaryCount,
  };
}
