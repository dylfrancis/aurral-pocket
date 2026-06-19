import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/auth-context";
import { getMyDiscoverLayout, updateMyDiscoverLayout } from "@/lib/api/me";
import type { DiscoverSection, DiscoverSectionId } from "@/lib/types/me";

const STORAGE_KEY_PREFIX = "discoverLayout";

export const DEFAULT_DISCOVER_SECTIONS: readonly DiscoverSection[] = [
  { id: "recentlyAdded", label: "Recently Added", enabled: true },
  { id: "playlists", label: "Playlists for You", enabled: true },
  { id: "recommendedShows", label: "Shows Near You", enabled: true },
  { id: "recentReleases", label: "Recent Releases", enabled: true },
  { id: "recommended", label: "Recommended for You", enabled: true },
  { id: "globalTop", label: "Global Trending", enabled: true },
  { id: "genreSections", label: "Because You Like", enabled: true },
];

const cloneDefaults = (): DiscoverSection[] =>
  DEFAULT_DISCOVER_SECTIONS.map((section) => ({ ...section }));

const storageKey = (userId?: number | null) =>
  userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;

export function normalizeDiscoverLayout(
  value: unknown,
): DiscoverSection[] | null {
  if (!Array.isArray(value)) return null;
  const defaultsById = new Map<DiscoverSectionId, DiscoverSection>(
    DEFAULT_DISCOVER_SECTIONS.map((item) => [item.id, { ...item }]),
  );
  const normalized: DiscoverSection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const id = (raw as { id?: unknown }).id;
    if (typeof id !== "string" || !defaultsById.has(id as DiscoverSectionId)) {
      continue;
    }
    const base = defaultsById.get(id as DiscoverSectionId)!;
    const enabled = (raw as { enabled?: unknown }).enabled;
    normalized.push({
      ...base,
      enabled: typeof enabled === "boolean" ? enabled : base.enabled,
    });
    defaultsById.delete(id as DiscoverSectionId);
  }
  defaultsById.forEach((item) => normalized.push({ ...item }));
  return normalized;
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
  layout: DiscoverSection[],
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
  const [sections, setSections] = useState<DiscoverSection[]>(cloneDefaults);
  // Holds the userId whose layout we've finished loading; `undefined` until the
  // first load completes. Deriving `hydrated` from it (rather than resetting a
  // boolean synchronously in the effect) keeps it correct across user changes
  // without a setState in the effect body.
  const [hydratedUserId, setHydratedUserId] = useState<
    number | null | undefined
  >(undefined);
  const hydrated = hydratedUserId === userId;
  const sectionsRef = useRef(sections);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await readStoredLayout(userId);
      if (cancelled) return;
      setSections(local ?? cloneDefaults());
      setHydratedUserId(userId);
      if (!userId) return;
      try {
        const response = await getMyDiscoverLayout();
        if (cancelled) return;
        const normalized = normalizeDiscoverLayout(response?.layout);
        if (normalized) {
          setSections(normalized);
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
      const previousSections = sectionsRef.current;
      let previousStorage: string | null = null;
      try {
        previousStorage = await AsyncStorage.getItem(storageKey(userId));
      } catch {}
      setSections(next);
      await writeStoredLayout(next, userId);
      try {
        const response = await updateMyDiscoverLayout(next);
        const saved = normalizeDiscoverLayout(response?.layout) ?? next;
        setSections(saved);
        await writeStoredLayout(saved, userId);
      } catch (err) {
        setSections(previousSections);
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
