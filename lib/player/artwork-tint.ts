import type { ImageColorsResult } from "react-native-image-colors";

// Relative luminance limits that keep the player's secondary text at 4.5:1:
// white at 70% needs 8:1 for full white, and the light player's gray needs
// 0.6. The light limit also sets how far the tint stands out from the light
// background, about 1.5:1.
const MAX_DARK_TINT_LUMINANCE = 0.08;
const MIN_LIGHT_TINT_LUMINANCE = 0.6;

/** Halvings per search, far finer than an 8-bit channel. */
const SEARCH_STEPS = 20;

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
  const luminance = relativeLuminance(linear);

  if (scheme === "dark") {
    if (luminance <= MAX_DARK_TINT_LUMINANCE) return toHex(rgb);
    // Luminance is linear in the channels, so one factor scales it exactly.
    const factor = MAX_DARK_TINT_LUMINANCE / luminance;
    const [r, g, b] = linear.map((c) => toSrgb(c * factor, Math.floor));
    return toHex({ r, g, b });
  }

  if (luminance >= MIN_LIGHT_TINT_LUMINANCE) return toHex(rgb);
  return lightenTo(linear, MIN_LIGHT_TINT_LUMINANCE);
}

/**
 * Raises the color's OKLCH lightness until its luminance reaches the floor,
 * keeping the hue and as much chroma as sRGB can show there. Mixing toward
 * white instead fades every cover to nearly the same pale gray.
 */
function lightenTo(linear: number[], minLuminance: number): string {
  const [start, labA, labB] = linearToOklab(linear);
  let low = start;
  let high = 1;
  for (let step = 0; step < SEARCH_STEPS; step++) {
    const mid = (low + high) / 2;
    const lightened = fitToGamut(mid, labA, labB);
    if (relativeLuminance(lightened) >= minLuminance) high = mid;
    else low = mid;
  }
  const [r, g, b] = fitToGamut(high, labA, labB).map((c) =>
    toSrgb(c, Math.ceil),
  );
  return toHex({ r, g, b });
}

/** The color at this lightness and hue, with its chroma cut until sRGB can show it. */
function fitToGamut(lightness: number, a: number, b: number): number[] {
  // share: how much of the cover's chroma is kept, 0 for a gray.
  const at = (share: number) =>
    oklabToLinear([lightness, a * share, b * share]);
  let kept = 1;
  if (!inGamut(at(kept))) {
    let low = 0;
    let high = 1;
    for (let step = 0; step < SEARCH_STEPS; step++) {
      const mid = (low + high) / 2;
      if (inGamut(at(mid))) low = mid;
      else high = mid;
    }
    kept = low;
  }
  // Rounding error can leave a gray a hair outside.
  return at(kept).map((c) => Math.min(1, Math.max(0, c)));
}

function inGamut(linear: number[]): boolean {
  return linear.every((c) => c >= 0 && c <= 1);
}

function relativeLuminance([r, g, b]: number[]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Björn Ottosson's OKLab, to and from linear sRGB.
function linearToOklab([r, g, b]: number[]): number[] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([lightness, a, b]: number[]): number[] {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
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
