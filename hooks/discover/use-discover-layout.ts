import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/auth-context";
import { getMyDiscoverLayout, updateMyDiscoverLayout } from "@/lib/api/me";
import type {
  DiscoverFeedStyle,
  DiscoverLayoutEntry,
  DiscoverLayoutSectionId,
  DiscoverSection,
} from "@/lib/types/me";

const STORAGE_KEY_PREFIX = "discoverLayout";

export const DEFAULT_DISCOVER_SECTIONS: readonly DiscoverSection[] = [
  { id: "recentlyAdded", label: "Recently Added", enabled: true },
  { id: "playlists", label: "Playlists", enabled: true },
  { id: "recommendedShows", label: "Shows Near You", enabled: true },
  { id: "recentReleases", label: "Recent Releases", enabled: true },
  { id: "recommended", label: "Recommended for You", enabled: true },
  { id: "globalTop", label: "Global Trending", enabled: true },
  { id: "genreSections", label: "Because You Like", enabled: true },
];

// Aurral's `lib/discoverLayout.ts`: every section in its default order, the
// row styles, and the sections that take one.
const LAYOUT_SECTION_IDS: readonly DiscoverLayoutSectionId[] = [
  "recentlyAdded",
  "playlists",
  "recommendedShows",
  "recentReleases",
  "news",
  "recommended",
  "globalTop",
  "genreSections",
];
const FEED_STYLES: readonly DiscoverFeedStyle[] = ["list", "square", "wide"];
const STYLED_SECTIONS: ReadonlySet<DiscoverLayoutSectionId> = new Set([
  "recommendedShows",
  "news",
]);

const POCKET_SECTIONS = new Map<DiscoverLayoutSectionId, DiscoverSection>(
  DEFAULT_DISCOVER_SECTIONS.map((section) => [section.id, section]),
);

const isLayoutSectionId = (value: unknown): value is DiscoverLayoutSectionId =>
  LAYOUT_SECTION_IDS.some((id) => id === value);

const isFeedStyle = (value: unknown): value is DiscoverFeedStyle =>
  FEED_STYLES.some((style) => style === value);

const defaultLayout = (): DiscoverLayoutEntry[] =>
  LAYOUT_SECTION_IDS.map((id) => ({ id, enabled: true }));

const storageKey = (userId?: number | null) =>
  userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;

/**
 * Reads a layout with every section Aurral lists, News included. Unknown and
 * repeated ids are dropped, a style is kept only on Shows and News, and
 * missing sections are added at the end, turned on.
 */
export function normalizeDiscoverLayout(
  value: unknown,
): DiscoverLayoutEntry[] | null {
  if (!Array.isArray(value)) return null;
  const remaining = new Set(LAYOUT_SECTION_IDS);
  const normalized: DiscoverLayoutEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const { id, enabled, style } = raw as Record<string, unknown>;
    if (!isLayoutSectionId(id) || !remaining.has(id)) continue;
    remaining.delete(id);
    const entry: DiscoverLayoutEntry = {
      id,
      enabled: typeof enabled === "boolean" ? enabled : true,
    };
    if (STYLED_SECTIONS.has(id) && isFeedStyle(style)) entry.style = style;
    normalized.push(entry);
  }
  remaining.forEach((id) => normalized.push({ id, enabled: true }));
  return normalized;
}

const sectionsOf = (layout: DiscoverLayoutEntry[]): DiscoverSection[] =>
  layout.flatMap((entry) => {
    const section = POCKET_SECTIONS.get(entry.id);
    return section ? [{ ...section, enabled: entry.enabled }] : [];
  });

/**
 * Puts pocket's sections, in their new order, into the slots they hold in
 * `layout`. News stays in its slot and every entry keeps its style, because
 * the server replaces the whole layout and pocket can't edit either.
 */
function withSections(
  layout: DiscoverLayoutEntry[],
  sections: DiscoverSection[],
): DiscoverLayoutEntry[] {
  const current = new Map(layout.map((entry) => [entry.id, entry]));
  const pending = sections.map(({ id, enabled }): DiscoverLayoutEntry => ({
    ...current.get(id),
    id,
    enabled,
  }));
  const merged = layout.flatMap((entry) => {
    if (!POCKET_SECTIONS.has(entry.id)) return [entry];
    const next = pending.shift();
    return next ? [next] : [];
  });
  return [...merged, ...pending];
}

async function readStoredLayout(userId?: number | null) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return normalizeDiscoverLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeStoredLayout(
  layout: DiscoverLayoutEntry[],
  userId?: number | null,
) {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(layout));
  } catch {}
}

export type UseDiscoverLayoutResult = {
  sections: DiscoverSection[];
  hydrated: boolean;
  saveLayout: (next: DiscoverSection[]) => Promise<void>;
};

export function useDiscoverLayout(): UseDiscoverLayoutResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [layout, setLayout] = useState<DiscoverLayoutEntry[]>(defaultLayout);
  // Holds the userId whose layout we've finished loading; `undefined` until the
  // first load completes. Deriving `hydrated` from it (rather than resetting a
  // boolean synchronously in the effect) keeps it correct across user changes
  // without a setState in the effect body.
  const [hydratedUserId, setHydratedUserId] = useState<
    number | null | undefined
  >(undefined);
  const hydrated = hydratedUserId === userId;
  const layoutRef = useRef(layout);
  const sections = useMemo(() => sectionsOf(layout), [layout]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await readStoredLayout(userId);
      if (cancelled) return;
      setLayout(local ?? defaultLayout());
      setHydratedUserId(userId);
      if (!userId) return;
      try {
        const response = await getMyDiscoverLayout();
        if (cancelled) return;
        const normalized = normalizeDiscoverLayout(response?.layout);
        if (normalized) {
          setLayout(normalized);
          await writeStoredLayout(normalized, userId);
        }
      } catch {
        // keep local
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveLayout = useCallback(
    async (next: DiscoverSection[]) => {
      const previousLayout = layoutRef.current;
      let previousStorage: string | null = null;
      try {
        previousStorage = await AsyncStorage.getItem(storageKey(userId));
      } catch {}
      const optimistic = withSections(previousLayout, next);
      setLayout(optimistic);
      await writeStoredLayout(optimistic, userId);
      try {
        // Build on the server's current layout, so a News or style change
        // made on the web since this one loaded isn't overwritten.
        const latest = await getMyDiscoverLayout();
        const merged = withSections(
          normalizeDiscoverLayout(latest?.layout) ?? previousLayout,
          next,
        );
        const response = await updateMyDiscoverLayout(merged);
        const saved = normalizeDiscoverLayout(response?.layout) ?? merged;
        setLayout(saved);
        await writeStoredLayout(saved, userId);
      } catch (err) {
        setLayout(previousLayout);
        try {
          if (previousStorage === null) {
            await AsyncStorage.removeItem(storageKey(userId));
          } else {
            await AsyncStorage.setItem(storageKey(userId), previousStorage);
          }
        } catch {}
        throw err;
      }
    },
    [userId],
  );

  return { sections, hydrated, saveLayout };
}
