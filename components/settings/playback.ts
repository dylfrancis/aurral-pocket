import type { SettingsPickerOption } from "@/components/settings/settings-controls";
import {
  CACHE_SIZE_OPTIONS,
  PREFETCH_OPTIONS,
  QUEUE_LIMIT_OPTIONS,
} from "@/lib/player/playback-settings";
import {
  supportsTranscodeFormat,
  TRANSCODE_BITRATES,
  TRANSCODE_FORMATS,
  TRANSCODE_OUTPUT,
  type TranscodeFormat,
  type TranscodeProfile,
} from "@/lib/player/transcoding";

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

export const TRANSCODE_FORMAT_CHOICES: SettingsPickerOption[] = [
  { value: 0, label: "Server Default" },
  ...TRANSCODE_FORMATS.flatMap((format, index) =>
    supportsTranscodeFormat(format)
      ? [{ value: index + 1, label: TRANSCODE_OUTPUT[format].label }]
      : [],
  ),
];

export const TRANSCODE_BITRATE_CHOICES: SettingsPickerOption[] =
  TRANSCODE_BITRATES.map((value) => ({
    value,
    label: `${value} kbps`,
  }));

export function formatValue(format: TranscodeFormat | null): number {
  return format && supportsTranscodeFormat(format)
    ? TRANSCODE_FORMATS.indexOf(format) + 1
    : 0;
}

export function formatAt(value: number): TranscodeFormat | null {
  return TRANSCODE_FORMATS[value - 1] ?? null;
}

export function profileSummary({ format, kbps }: TranscodeProfile): string {
  return format && supportsTranscodeFormat(format)
    ? `${TRANSCODE_OUTPUT[format].label} · ${kbps} kbps`
    : "Server Default";
}
