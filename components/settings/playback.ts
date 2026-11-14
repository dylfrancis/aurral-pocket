import type { SettingsPickerOption } from "@/components/settings/settings-controls";
import {
  CACHE_SIZE_OPTIONS,
  PREFETCH_OPTIONS,
  QUEUE_LIMIT_OPTIONS,
} from "@/lib/player/playback-settings";

function trackCountLabel(count: number): string {
  return count === 1 ? "1 Track" : `${count} Tracks`;
}

export const PREFETCH_CHOICES: SettingsPickerOption[] = PREFETCH_OPTIONS.map(
  (value) => ({ value, label: value === 0 ? "Off" : trackCountLabel(value) }),
);

export const QUEUE_LIMIT_CHOICES: SettingsPickerOption[] =
  QUEUE_LIMIT_OPTIONS.map((value) => ({
    value,
    label: value === 0 ? "No Limit" : trackCountLabel(value),
  }));

/** Whole sizes, as "1 GB" rather than formatBytes's "1.0 GB". */
export const CACHE_SIZE_CHOICES: SettingsPickerOption[] =
  CACHE_SIZE_OPTIONS.map((value) => ({
    value,
    label: value >= 1e9 ? `${value / 1e9} GB` : `${value / 1e6} MB`,
  }));
