import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
  TSpan,
} from "react-native-svg";

const TAG_COLORS = [
  "#845336",
  "#57553c",
  "#a17e3e",
  "#43454f",
  "#604848",
  "#5c6652",
  "#a18b62",
  "#8c4f4a",
  "#898471",
  "#c8b491",
  "#65788f",
  "#755e4a",
  "#718062",
  "#bc9d66",
];

const ARTWORK_SIZE = 1000;

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

const hashString = (value: string): number => {
  let hash = 0;
  const input = String(value || "");
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
};

const hexToRgb = (hex: string) => {
  const n = String(hex || "")
    .replace("#", "")
    .trim();
  if (!/^[0-9a-fA-F]{6}$/.test(n)) return { r: 33, g: 31, b: 39 };
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b]
    .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

const mixHex = (left: string, right: string, weight = 0.5) => {
  const t = clamp(weight, 0, 1);
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
};

const hexToRgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
};

const normalizeDisplayName = (name: string) =>
  String(name || "")
    .replace(/^\[(?:A|AS)\]\s*/i, "")
    .replace(/^Aurral(?: Shared)?\s+/i, "")
    .trim();

const normalizeKind = (kind: string) =>
  String(kind || "")
    .trim()
    .toLowerCase() === "flow"
    ? "Flow"
    : "Playlist";

const chunkWord = (word: string, limit: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < word.length; i += limit) {
    chunks.push(word.slice(i, i + limit));
  }
  return chunks;
};

const buildTitleLines = (value: string): string[] => {
  const input = String(value || "").trim() || "Untitled";
  const target = input.length > 24 ? 13 : input.length > 16 ? 16 : 20;
  const words = input
    .split(/\s+/)
    .flatMap((word) =>
      word.length > target ? chunkWord(word, target) : [word],
    )
    .filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= target || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === 2) break;
  }
  if (lines.length < 2 && current) lines.push(current);
  if (lines.length > 2) lines.length = 2;
  const consumed = lines.join(" ").length;
  if (consumed < input.length) {
    const lastIndex = Math.max(lines.length - 1, 0);
    const base = lines[lastIndex] || input.slice(0, target);
    lines[lastIndex] =
      base.length >= target
        ? `${base.slice(0, Math.max(target - 1, 1)).trimEnd()}…`
        : `${base}…`;
  }
  return lines.slice(0, 2);
};

type Palette = {
  bgStart: string;
  bgEnd: string;
  blob1: string;
  blob2: string;
  blob3: string;
  blob4: string;
  chip: string;
  chipStroke: string;
  title: string;
  subtitle: string;
};

const getPalette = (name: string): Palette => {
  const hash = hashString(name);
  const base1 = TAG_COLORS[hash % TAG_COLORS.length];
  const base2 = TAG_COLORS[(hash + 3) % TAG_COLORS.length];
  const base3 = TAG_COLORS[(hash + 7) % TAG_COLORS.length];
  const base4 = TAG_COLORS[(hash + 11) % TAG_COLORS.length];
  return {
    bgStart: mixHex(base1, "#11131a", 0.58),
    bgEnd: mixHex(base2, "#090a0f", 0.7),
    blob1: hexToRgba(base1, 0.45),
    blob2: hexToRgba(base2, 0.35),
    blob3: hexToRgba(base3, 0.4),
    blob4: hexToRgba(base4, 0.3),
    chip: mixHex(base1, "#ffffff", 0.22),
    chipStroke: hexToRgba("#ffffff", 0.16),
    title: "#f5f2ea",
    subtitle: "rgba(245, 242, 234, 0.76)",
  };
};

const generateBlobPath = (cx: number, cy: number, r: number, seed: number) => {
  const points: { x: number; y: number }[] = [];
  const numPoints = 5 + (seed % 4);
  const angleStep = (Math.PI * 2) / numPoints;
  for (let i = 0; i < numPoints; i += 1) {
    const angle = i * angleStep;
    const variance = 0.7 + ((seed * (i + 1) * 11) % 60) / 100;
    const pr = r * variance;
    points.push({
      x: cx + Math.cos(angle) * pr,
      y: cy + Math.sin(angle) * pr,
    });
  }
  const mids = points.map((p, i) => {
    const next = points[(i + 1) % numPoints];
    return { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
  });
  let path = `M ${mids[0].x} ${mids[0].y}`;
  for (let i = 1; i <= numPoints; i += 1) {
    const p = points[i % numPoints];
    const mid = mids[i % numPoints];
    path += ` Q ${p.x} ${p.y} ${mid.x} ${mid.y}`;
  }
  return `${path} Z`;
};

type Props = {
  name: string;
  size: number;
  radius?: number;
  kind?: "flow" | "playlist";
  showText?: boolean;
};

export function FlowArtwork({
  name,
  size,
  radius = 12,
  kind = "playlist",
  showText = true,
}: Props) {
  const display = normalizeDisplayName(name) || "Untitled";
  const normalizedKind = normalizeKind(kind);
  const palette = getPalette(display);
  const seed = hashString(display);
  const titleLines = buildTitleLines(display);
  const titleY = titleLines.length === 1 ? 500 : 450;
  const titleSize = titleLines.some((line) => line.length > 16) ? 104 : 116;
  const chipWidth = normalizedKind === "Flow" ? 188 : 220;
  const chipX = (ARTWORK_SIZE - chipWidth) / 2;
  const chipLabel = normalizedKind.toUpperCase().split("").join(" ");

  const b1 = generateBlobPath(
    200 + (seed % 200),
    200 + ((seed >> 1) % 200),
    250 + (seed % 100),
    seed,
  );
  const b2 = generateBlobPath(
    800 - (seed % 200),
    800 - ((seed >> 2) % 200),
    300 + (seed % 150),
    seed + 1,
  );
  const b3 = generateBlobPath(
    800 - ((seed >> 3) % 200),
    200 + ((seed >> 4) % 200),
    200 + (seed % 100),
    seed + 2,
  );
  const b4 = generateBlobPath(
    200 + ((seed >> 5) % 200),
    800 - ((seed >> 6) % 200),
    250 + (seed % 100),
    seed + 3,
  );

  return (
    <View
      style={[styles.wrap, { width: size, height: size, borderRadius: radius }]}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${ARTWORK_SIZE} ${ARTWORK_SIZE}`}
      >
        <Defs>
          <LinearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={palette.bgStart} />
            <Stop offset="100%" stopColor={palette.bgEnd} />
          </LinearGradient>
        </Defs>
        <Rect width={ARTWORK_SIZE} height={ARTWORK_SIZE} fill="url(#bg)" />
        <Path d={b1} fill={palette.blob1} />
        <Path d={b2} fill={palette.blob2} />
        <Path d={b3} fill={palette.blob3} />
        <Path d={b4} fill={palette.blob4} />
        {showText ? (
          <>
            <Rect
              x={chipX}
              y={136}
              width={chipWidth}
              height={58}
              rx={29}
              fill={palette.chip}
              stroke={palette.chipStroke}
            />
            <SvgText
              x={500}
              y={174}
              textAnchor="middle"
              fontSize={28}
              fontWeight="700"
              fill={palette.subtitle}
            >
              {chipLabel}
            </SvgText>
            <SvgText
              x={500}
              y={titleY}
              textAnchor="middle"
              fontSize={titleSize}
              fontWeight="800"
              fill={palette.title}
            >
              {titleLines.map((line, idx) => (
                <TSpan key={idx} x={500} dy={idx === 0 ? 0 : 128}>
                  {line}
                </TSpan>
              ))}
            </SvgText>
            <SvgText
              x={500}
              y={878}
              textAnchor="middle"
              fontSize={28}
              fontWeight="600"
              fill={palette.subtitle}
            >
              A U R R A L
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
  },
});
