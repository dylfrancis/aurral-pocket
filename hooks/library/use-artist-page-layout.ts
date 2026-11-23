import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/auth-context";

export type ArtistPageSectionId =
  "tags" | "songs" | "library" | "releases" | "similar" | "about";

export type ArtistPageSection = {
  id: ArtistPageSectionId;
  label: string;
  enabled: boolean;
};

/** Every section below the hero, in the page's own order. */
export const DEFAULT_ARTIST_PAGE_SECTIONS: readonly ArtistPageSection[] = [
  { id: "tags", label: "Tags", enabled: true },
  { id: "songs", label: "Songs", enabled: true },
  { id: "library", label: "In Your Library", enabled: true },
  { id: "releases", label: "Albums & Releases", enabled: true },
  { id: "similar", label: "Similar Artists", enabled: true },
  { id: "about", label: "About", enabled: true },
];

const STORAGE_KEY_PREFIX = "artistPageLayout";

const storageKey = (userId: number | null) =>
  userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;

const defaultSections = () =>
  DEFAULT_ARTIST_PAGE_SECTIONS.map((section) => ({ ...section }));

/**
 * Reads a stored layout. Unknown and repeated ids are dropped, and a section
 * added since the layout was saved joins at the end, turned on.
 */
export function normalizeArtistPageLayout(value: unknown): ArtistPageSection[] {
  if (!Array.isArray(value)) return defaultSections();
  const remaining = new Map(
    DEFAULT_ARTIST_PAGE_SECTIONS.map((section) => [section.id, section]),
  );
  const sections: ArtistPageSection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const { id, enabled } = raw as Record<string, unknown>;
    const section = remaining.get(id as ArtistPageSectionId);
    if (!section) continue;
    remaining.delete(section.id);
    sections.push({
      ...section,
      enabled: typeof enabled === "boolean" ? enabled : true,
    });
  }
  remaining.forEach((section) => sections.push({ ...section }));
  return sections;
}

async function readStoredLayout(userId: number | null) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return normalizeArtistPageLayout(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultSections();
  }
}

type LayoutListener = (
  userId: number | null,
  sections: ArtistPageSection[],
) => void;

// Settings and every artist page in the stacks hold the layout, so a save
// on one reaches the rest through here.
const layoutListeners = new Set<LayoutListener>();

// Each account's layout once read, so later artist pages open in its order.
const loadedLayouts = new Map<number | null, ArtistPageSection[]>();

/**
 * Which artist page sections show, in which order, for the signed-in
 * account. Kept on the phone: Aurral stores no artist page layout.
 */
export function useArtistPageLayout() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [sections, setSections] = useState(
    () => loadedLayouts.get(userId) ?? defaultSections(),
  );
  // The account whose layout has loaded, so a switch of account waits for
  // its own.
  const [hydratedUserId, setHydratedUserId] = useState<
    number | null | undefined
  >(() => (loadedLayouts.has(userId) ? userId : undefined));

  useEffect(() => {
    const listener: LayoutListener = (changedUserId, next) => {
      if (changedUserId === userId) setSections(next);
    };
    layoutListeners.add(listener);
    return () => {
      layoutListeners.delete(listener);
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    void readStoredLayout(userId).then((stored) => {
      // A save made before the read finished is newer than what was read.
      if (!loadedLayouts.has(userId)) loadedLayouts.set(userId, stored);
      if (cancelled) return;
      setSections(loadedLayouts.get(userId) ?? stored);
      setHydratedUserId(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveLayout = useCallback(
    async (next: ArtistPageSection[]) => {
      const entries = next.map(({ id, enabled }) => ({ id, enabled }));
      await AsyncStorage.setItem(storageKey(userId), JSON.stringify(entries));
      loadedLayouts.set(userId, next);
      layoutListeners.forEach((listener) => listener(userId, next));
    },
    [userId],
  );

  return { sections, hydrated: hydratedUserId === userId, saveLayout };
}
