import type { File } from "expo-file-system";
import {
  isMetered,
  isOffline,
  networkKnown,
  onMeteredChange,
  onNetworkChange,
} from "@/lib/offline/network";
import { audioFormatLabel } from "@/lib/player/audio-format";
import {
  getPlaybackSettings,
  onPlaybackSettingsChange,
  playbackSettingsReady,
} from "@/lib/player/playback-settings";

/** What offline saves and the fetched-ahead cache share. */

/** Tries per file before a lost connection, busy server or refused session sticks. */
export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 2_000;

/** The container each format the player names comes in. */
const LABEL_EXTENSIONS: Record<string, string> = {
  FLAC: "flac",
  MP3: "mp3",
  AAC: "m4a",
  ALAC: "m4a",
  Opus: "opus",
  Vorbis: "ogg",
  WAV: "wav",
  AIFF: "aiff",
};

const EXTENSION_PATTERN = /^[a-z0-9]{1,5}$/;

/**
 * Files are named by track, with the file's extension: iOS picks the parser
 * by it. The server's extension wins; without one, the format's container.
 * `format` is a scanner's codec name or a label the player gave, such as "WAV".
 */
export function fileName(
  id: string,
  extension: string | null | undefined,
  format: string | null | undefined,
): string {
  const safeId = id.replace(/[^A-Za-z0-9_-]/g, "_");
  const given = (extension ?? "").toLowerCase();
  const label =
    format && Object.hasOwn(LABEL_EXTENSIONS, format)
      ? format
      : audioFormatLabel(format, null);
  const fromLabel = label
    ? (LABEL_EXTENSIONS[label] ?? label.toLowerCase())
    : "";
  const ext = EXTENSION_PATTERN.test(given)
    ? given
    : EXTENSION_PATTERN.test(fromLabel)
      ? fromLabel
      : undefined;
  return ext ? `${safeId}.${ext}` : safeId;
}

export function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {}
}

/** Both platforms put the status in the message, as in "HTTP 401". */
export function httpStatusOf(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = /\b(?:HTTP|status)\s+(\d{3})\b/i.exec(message);
  return match ? Number(match[1]) : null;
}

/** The path the engine plays a file from: it reads a leading "/" as local. */
export function enginePath(file: File): string {
  return decodeURI(file.uri.replace(/^file:\/\//, ""));
}

/** Why downloads wait: no connection, or cellular with Wi-Fi Only on. */
export type DownloadHold = "offline" | "wifi" | null;

export function downloadHold(): DownloadHold {
  if (isOffline()) return "offline";
  if (getPlaybackSettings().wifiOnly && isMetered()) return "wifi";
  return null;
}

/**
 * Settles once the connection and the settings are known, so a cold start on
 * cellular with Wi-Fi Only on doesn't begin a download.
 */
export function downloadHoldKnown(): Promise<void> {
  return Promise.all([networkKnown(), playbackSettingsReady()]).then(() => {});
}

/**
 * Hear the hold change: the connection going or coming back, a move between
 * Wi-Fi and cellular, or Wi-Fi Only turned on or off. Returns unsubscribe.
 */
export function onDownloadHoldChange(
  listener: (hold: DownloadHold) => void,
): () => void {
  let last = downloadHold();
  const check = () => {
    const hold = downloadHold();
    if (hold === last) return;
    last = hold;
    listener(hold);
  };
  const unsubscribes = [
    onNetworkChange(check),
    onMeteredChange(check),
    onPlaybackSettingsChange(check),
  ];
  return function unsubscribe(): void {
    unsubscribes.forEach((stop) => stop());
  };
}
