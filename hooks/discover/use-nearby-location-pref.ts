import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MODE_KEY = "discoverNearbyMode";
const ZIP_KEY = "discoverNearbyZip";

export type NearbyLocationMode = "ip" | "zip";

export function useNearbyLocationPref() {
  const [mode, setModeState] = useState<NearbyLocationMode>("ip");
  const [appliedZip, setAppliedZipState] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(MODE_KEY), AsyncStorage.getItem(ZIP_KEY)])
      .then(([storedMode, storedZip]) => {
        if (storedMode === "zip" || storedMode === "ip") {
          setModeState(storedMode);
        }
        if (storedZip) setAppliedZipState(storedZip);
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

  return { mode, appliedZip, hydrated, setMode, setAppliedZip };
}
