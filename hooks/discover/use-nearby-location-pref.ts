import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MODE_KEY = "discoverNearbyMode";
const ZIP_KEY = "discoverNearbyZip";
const RADIUS_KEY = "discoverNearbyRadius";

export type NearbyLocationMode = "ip" | "zip";

export const DEFAULT_NEARBY_RADIUS_MILES = 50;
export const NEARBY_RADIUS_OPTIONS = [25, 50, 100, 250] as const;

export function useNearbyLocationPref() {
  const [mode, setModeState] = useState<NearbyLocationMode>("ip");
  const [appliedZip, setAppliedZipState] = useState<string>("");
  const [radiusMiles, setRadiusMilesState] = useState<number>(
    DEFAULT_NEARBY_RADIUS_MILES,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(MODE_KEY),
      AsyncStorage.getItem(ZIP_KEY),
      AsyncStorage.getItem(RADIUS_KEY),
    ])
      .then(([storedMode, storedZip, storedRadius]) => {
        if (storedMode === "zip" || storedMode === "ip") {
          setModeState(storedMode);
        }
        if (storedZip) setAppliedZipState(storedZip);
        const parsedRadius = Number(storedRadius);
        if (Number.isFinite(parsedRadius) && parsedRadius > 0) {
          setRadiusMilesState(parsedRadius);
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const setMode = useCallback((next: NearbyLocationMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }, []);

  const setAppliedZip = useCallback((next: string) => {
    setAppliedZipState(next);
    AsyncStorage.setItem(ZIP_KEY, next).catch(() => {});
  }, []);

  const setRadiusMiles = useCallback((next: number) => {
    setRadiusMilesState(next);
    AsyncStorage.setItem(RADIUS_KEY, String(next)).catch(() => {});
  }, []);

  return {
    mode,
    appliedZip,
    radiusMiles,
    hydrated,
    setMode,
    setAppliedZip,
    setRadiusMiles,
  };
}
