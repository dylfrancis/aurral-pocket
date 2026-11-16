import {
  DEFAULT_TRANSCODING,
  transcodeForSource,
} from "@/lib/player/transcoding";

const flac = { audioFormat: "FLAC", bitrateKbps: 840 };
const profiles = {
  ...DEFAULT_TRANSCODING,
  cellular: { format: "mp3", kbps: 96, losslessOnly: true },
  wifi: { format: "aac", kbps: 192, losslessOnly: false },
} as const;

it("leaves both networks on Aurral's normal playback until configured", () => {
  expect(transcodeForSource(DEFAULT_TRANSCODING, false, flac)).toBeUndefined();
  expect(transcodeForSource(DEFAULT_TRANSCODING, true, flac)).toBeUndefined();
});

it("uses only the active network's profile and preserves lossy tracks in lossless-only mode", () => {
  expect(transcodeForSource(profiles, true, flac)).toEqual({
    format: "mp3",
    kbps: 96,
  });
  expect(transcodeForSource(profiles, false, flac)).toEqual({
    format: "aac",
    kbps: 192,
  });
  expect(
    transcodeForSource(profiles, true, {
      audioFormat: "AAC",
      bitrateKbps: 256,
    }),
  ).toBeUndefined();
  expect(
    transcodeForSource(profiles, false, {
      audioFormat: "AAC",
      bitrateKbps: 128,
    }),
  ).toBeUndefined();
});

it("prefers lossless on Wi-Fi and still allows fallback for an unsupported source", () => {
  const settings = {
    ...profiles,
    preferLosslessOnWifi: true,
    fallbackFormat: "mp3",
  } as const;
  expect(transcodeForSource(settings, false, flac)).toBeUndefined();
  expect(transcodeForSource(settings, false, { audioFormat: "APE" })).toEqual({
    format: "mp3",
    kbps: 192,
    required: true,
  });
});
