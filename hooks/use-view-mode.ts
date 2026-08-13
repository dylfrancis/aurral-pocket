import { useCallback, useEffect, useState } from "react";
import { AppStorage } from "@/lib/storage";

export type ViewMode = "list" | "grid";

// In-memory mirror of the persisted map so screens mount with the stored
// value after the first load in a session.
let cache: Record<string, ViewMode> | null = null;
let pendingLoad: Promise<Record<string, ViewMode>> | null = null;

function isViewMode(value: unknown): value is ViewMode {
  return value === "list" || value === "grid";
}

async function loadCache(): Promise<Record<string, ViewMode>> {
  if (cache) return cache;
  pendingLoad ??= AppStorage.getViewModes().then((stored) => {
    const valid: Record<string, ViewMode> = {};
    for (const [key, value] of Object.entries(stored)) {
      if (isViewMode(value)) valid[key] = value;
    }
    cache = valid;
    return valid;
  });
  return pendingLoad;
}

export function useViewMode(screenKey: string, defaultMode: ViewMode) {
  const [mode, setModeState] = useState<ViewMode>(
    () => cache?.[screenKey] ?? defaultMode,
  );

  useEffect(() => {
    let cancelled = false;
    void loadCache().then((loaded) => {
      const stored = loaded[screenKey];
      if (!cancelled && stored) setModeState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [screenKey]);

  const setMode = useCallback(
    (next: ViewMode) => {
      setModeState(next);
      void loadCache().then((loaded) => {
        loaded[screenKey] = next;
        void AppStorage.setViewModes(loaded);
      });
    },
    [screenKey],
  );

  return [mode, setMode] as const;
}
