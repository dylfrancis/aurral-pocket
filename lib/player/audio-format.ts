/**
 * A library file brings its scanner's codec name ("MPEG 1 Layer 3"), a
 * download the server's format family ("m4a").
 */
export function audioFormatLabel(
  rawCodec: string | null | undefined,
  rawExtension: string | null | undefined,
): string | null {
  const codec = (rawCodec ?? "").trim().toLowerCase();
  const ext = (rawExtension ?? "").trim().toLowerCase();

  if (codec.includes("flac") || ext === "flac") return "FLAC";
  // Before AAC: both arrive as .m4a, and only the codec tells them apart.
  if (codec.includes("alac")) return "ALAC";
  if (codec.includes("layer 3") || codec.includes("mp3") || ext === "mp3") {
    return "MP3";
  }
  // The server's "m4a" family is the lossy one; ALAC never gets a family.
  if (codec.includes("aac") || codec === "m4a" || ext === "aac") return "AAC";
  if (codec.includes("opus") || ext === "opus") return "Opus";
  if (codec.includes("vorbis") || ext === "ogg") return "Vorbis";
  if (ext === "wav") return "WAV";
  if (ext === "aif" || ext === "aiff") return "AIFF";
  return ext ? ext.toUpperCase() : null;
}
