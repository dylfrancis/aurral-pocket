import { Platform } from "react-native";

export const TRANSCODE_FORMATS = ["mp3", "aac", "opus"] as const;
export type TranscodeFormat = (typeof TRANSCODE_FORMATS)[number];
export const TRANSCODE_BITRATES = [64, 96, 128, 160, 192, 224, 256, 320];

export type TranscodeProfile = {
  format: TranscodeFormat | null;
  kbps: number;
  losslessOnly: boolean;
};
export type TranscodingSettings = {
  cellular: TranscodeProfile;
  wifi: TranscodeProfile;
  preferLosslessOnWifi: boolean;
  fallbackFormat: TranscodeFormat | null;
};
export type TranscodeRequest = {
  format: TranscodeFormat;
  kbps: number;
  required?: true;
};

const DEFAULT_PROFILE: TranscodeProfile = {
  format: null,
  kbps: 128,
  losslessOnly: false,
};
export const DEFAULT_TRANSCODING: TranscodingSettings = {
  cellular: DEFAULT_PROFILE,
  wifi: DEFAULT_PROFILE,
  preferLosslessOnWifi: false,
  fallbackFormat: null,
};

export const TRANSCODE_OUTPUT = {
  mp3: {
    label: "MP3",
    container: "mp3",
    extension: "mp3",
    mime: ["audio/mpeg", "audio/mp3"],
  },
  aac: {
    label: "AAC",
    container: "adts",
    extension: "aac",
    mime: ["audio/aac", "audio/aacp"],
  },
  opus: {
    label: "Opus",
    container: "ogg",
    extension: "opus",
    mime: ["audio/ogg", "application/ogg"],
  },
} as const;

export function supportsTranscodeFormat(format: TranscodeFormat): boolean {
  // Aurral serves Opus in Ogg. The Android engine supports this container;
  // Pocket's iOS engine uses AVQueuePlayer rather than Safari's media engine.
  return format !== "opus" || Platform.OS === "android";
}

export function transcodeForSource(
  settings: TranscodingSettings,
  metered: boolean,
  source: { audioFormat?: string | null; bitrateKbps?: number | null },
): TranscodeRequest | undefined {
  const profile = metered ? settings.cellular : settings.wifi;
  const format = source.audioFormat?.toLowerCase();
  const lossless =
    format !== undefined &&
    ["flac", "alac", "wav", "aiff", "ape", "wv", "dsf", "dff"].includes(format);
  const unsupported =
    format !== undefined &&
    (["wma", "ape", "wv", "dsf", "dff"].includes(format) ||
      (Platform.OS === "ios" && ["ogg", "vorbis", "opus"].includes(format)));
  if (
    unsupported &&
    settings.fallbackFormat &&
    supportsTranscodeFormat(settings.fallbackFormat)
  ) {
    return {
      format: settings.fallbackFormat,
      kbps: profile.kbps,
      required: true,
    };
  }
  if (
    !profile.format ||
    !supportsTranscodeFormat(profile.format) ||
    (!metered && settings.preferLosslessOnWifi && lossless) ||
    (profile.losslessOnly && !lossless) ||
    (source.bitrateKbps && source.bitrateKbps <= profile.kbps && !unsupported)
  ) {
    return undefined;
  }
  return {
    format: profile.format,
    kbps: profile.kbps,
    ...(unsupported ? { required: true } : {}),
  };
}

export function transcodeKey({ format, kbps }: TranscodeRequest): string {
  return `${format}-${kbps}`;
}
