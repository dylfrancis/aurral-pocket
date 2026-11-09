import type { ImageColorsResult } from "react-native-image-colors";

// Relative luminance limits that keep the player's secondary text at 4.5:1:
// white at 70% needs 8:1 for full white, and the theme's gray needs 0.85.
const MAX_DARK_TINT_LUMINANCE = 0.08;
const MIN_LIGHT_TINT_LUMINANCE = 0.85;

/** Below these, a color reads as gray or black rather than as the cover's color. */
const MIN_SATURATION = 0.25;
const MIN_VALUE = 0.2;

type Rgb = { r: number; g: number; b: number };

export function pickCoverColor(colors: ImageColorsResult): string | null {
  // iOS puts the cover's most common color first. On a dark sleeve that is
  // black, so the lively accents behind it are the fallback.
  const candidates =
    colors.platform === "ios"
      ? [colors.background, colors.primary, colors.secondary, colors.detail]
      : [
          colors.dominant,
          colors.vibrant,
          colors.darkVibrant,
          colors.muted,
          colors.darkMuted,
        ];
  const parsed = candidates
    .map(parseHex)
    .filter((rgb): rgb is Rgb => rgb !== null);
  if (parsed.length === 0) return null;
  return toHex(parsed.find(isLively) ?? parsed[0]);
}

/** Darkens or lightens the cover color, keeping its hue, so the scheme's text reads on it. */
export function tintForScheme(hex: string, scheme: "light" | "dark"): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const linear = [rgb.r, rgb.g, rgb.b].map(toLinear);
  const luminance =
    0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];

  if (scheme === "dark") {
    if (luminance <= MAX_DARK_TINT_LUMINANCE) return toHex(rgb);
    // Luminance is linear in the channels, so one factor scales it exactly.
    const factor = MAX_DARK_TINT_LUMINANCE / luminance;
    const [r, g, b] = linear.map((c) => toSrgb(c * factor, Math.floor));
    return toHex({ r, g, b });
  }

  if (luminance >= MIN_LIGHT_TINT_LUMINANCE) return toHex(rgb);
  const distanceKept = (1 - MIN_LIGHT_TINT_LUMINANCE) / (1 - luminance);
  const [r, g, b] = linear.map((c) =>
    toSrgb(1 - (1 - c) * distanceKept, Math.ceil),
  );
  return toHex({ r, g, b });
}

function isLively({ r, g, b }: Rgb): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const value = max / 255;
  const saturation = max === 0 ? 0 : (max - min) / max;
  return value >= MIN_VALUE && saturation >= MIN_SATURATION;
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Back to an 8-bit channel. The rounding is chosen per direction, so it can't
 * carry the luminance back across the limit it was just moved to.
 */
function toSrgb(linear: number, round: (n: number) => number): number {
  const c =
    linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return round(Math.min(1, Math.max(0, c)) * 255);
}

/** #rrggbb, or #rrggbbaa with the alpha ignored. */
function parseHex(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
