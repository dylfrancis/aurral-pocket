import { audioFormatLabel } from "@/lib/player/audio-format";

describe("audioFormatLabel", () => {
  it.each([
    // What a library file's scanner records, with the file's extension.
    ["FLAC", "flac", "FLAC"],
    ["MPEG 1 Layer 3", "mp3", "MP3"],
    ["ALAC", "m4a", "ALAC"],
    ["AAC", "m4a", "AAC"],
    // What a download's quality check records.
    ["mp3", "mp3", "MP3"],
    ["m4a", "m4a", "AAC"],
    // Nothing recorded but the extension.
    [null, "opus", "Opus"],
    [null, "wv", "WV"],
  ])("names %s in a .%s file %s", (codec, extension, label) => {
    expect(audioFormatLabel(codec, extension)).toBe(label);
  });

  it("names nothing when neither is known", () => {
    expect(audioFormatLabel(null, null)).toBeNull();
  });
});
