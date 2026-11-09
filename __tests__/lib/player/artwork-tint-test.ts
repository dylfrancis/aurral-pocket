import type { ImageColorsResult } from "react-native-image-colors";
import { Colors } from "@/constants/theme";
import { pickCoverColor, tintForScheme } from "@/lib/player/artwork-tint";

type IOSImageColors = Extract<ImageColorsResult, { platform: "ios" }>;
type AndroidImageColors = Extract<ImageColorsResult, { platform: "android" }>;

function ios(colors: Partial<IOSImageColors>): IOSImageColors {
  return {
    platform: "ios",
    background: "#000000",
    primary: "#000000",
    secondary: "#000000",
    detail: "#000000",
    quality: "low",
    ...colors,
  };
}

function android(colors: Partial<AndroidImageColors>): AndroidImageColors {
  return {
    platform: "android",
    dominant: "#000000",
    average: "#000000",
    vibrant: "#000000",
    darkVibrant: "#000000",
    lightVibrant: "#000000",
    darkMuted: "#000000",
    lightMuted: "#000000",
    muted: "#000000",
    ...colors,
  };
}

function channels(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function wcagContrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("pickCoverColor", () => {
  it("takes the cover's accent over a black background", () => {
    // A red sun on a black sleeve should tint the player red, not black.
    expect(
      pickCoverColor(ios({ background: "#050505", primary: "#e0402a" })),
    ).toBe("#e0402a");
  });

  it("falls back to the most common color when nothing is lively", () => {
    expect(
      pickCoverColor(ios({ background: "#f2f2f2", primary: "#d0d0d0" })),
    ).toBe("#f2f2f2");
  });

  it("reads Android's dominant color first", () => {
    expect(
      pickCoverColor(android({ dominant: "#1f5fd0", vibrant: "#e0402a" })),
    ).toBe("#1f5fd0");
  });
});

describe("tintForScheme", () => {
  const covers = [
    ["bright yellow", "#ffe600"],
    ["mid red", "#e0402a"],
    ["navy", "#0a1a5c"],
    ["white", "#ffffff"],
    ["black", "#000000"],
  ];

  it.each(covers)(
    "keeps the dark player's secondary text readable on %s",
    (_name, color) => {
      const tint = tintForScheme(color, "dark");

      // White at 70%, as the dark player draws its secondary text, needs the
      // tint at 8:1 against full white.
      expect(wcagContrast(tint, "#ffffff")).toBeGreaterThanOrEqual(8);
    },
  );

  it.each(covers)(
    "keeps the light player's secondary text readable on %s",
    (_name, color) => {
      const tint = tintForScheme(color, "light");

      expect(wcagContrast(tint, Colors.light.subtle)).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  it("keeps the cover's hue in both schemes", () => {
    for (const scheme of ["dark", "light"] as const) {
      const [r, g, b] = channels(tintForScheme("#e0402a", scheme));
      expect(r).toBeGreaterThan(g);
      expect(r).toBeGreaterThan(b);
    }
  });

  it("leaves a color that already reads alone", () => {
    expect(tintForScheme("#3a0d0a", "dark")).toBe("#3a0d0a");
    expect(tintForScheme("#fff3e0", "light")).toBe("#fff3e0");
  });
});
