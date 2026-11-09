import { formatDistanceStrict } from "date-fns";
import type { TrendingMovement } from "@/lib/types/search";

const COMPACT_STEPS = [
  { size: 1e9, suffix: "B" },
  { size: 1e6, suffix: "M" },
  { size: 1e3, suffix: "K" },
];

const roundCompact = (scaled: number) =>
  scaled < 10 ? Math.round(scaled * 10) / 10 : Math.round(scaled);

/** 950, 12K, 1.2M: one decimal below ten, none above. */
export function formatCompactCount(count: number): string {
  for (const [index, { size, suffix }] of COMPACT_STEPS.entries()) {
    if (count < size) continue;
    const rounded = roundCompact(count / size);
    // 999,999 rounds to 1000K, which reads better as 1M.
    const larger = COMPACT_STEPS[index - 1];
    if (rounded >= 1000 && larger) {
      return `${roundCompact(count / larger.size)}${larger.suffix}`;
    }
    return `${rounded}${suffix}`;
  }
  return String(count);
}

/** Falls back to the code: Hermes has no Intl.DisplayNames. */
export function formatRegionName(region: string | null): string | null {
  if (!region) return null;
  try {
    return (
      new Intl.DisplayNames(undefined, { type: "region" }).of(region) ?? region
    );
  } catch {
    return region;
  }
}

export function formatChartsMeta(
  region: string | null,
  updatedAt: number | null,
  now: Date = new Date(),
): string | null {
  const updated =
    updatedAt === null
      ? null
      : `Updated ${formatDistanceStrict(updatedAt, now, { addSuffix: true })}`;
  return (
    [formatRegionName(region), updated].filter(Boolean).join(" · ") || null
  );
}

export function describeMovement(movement: TrendingMovement): string | null {
  if (movement === "new") return "new entry";
  if (!movement) return null;
  const places = Math.abs(movement);
  return `${movement > 0 ? "up" : "down"} ${places} ${places === 1 ? "place" : "places"}`;
}
