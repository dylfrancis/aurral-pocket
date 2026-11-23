import { useCallback, useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MODE_KEY = "discoverNearbyMode";
const ZIP_KEY = "discoverNearbyZip";
const COUNTRY_KEY = "discoverNearbyCountry";

export type NearbyLocationMode = "ip" | "zip";

type NearbyLocationState = {
  mode: NearbyLocationMode;
  zip: string;
  country: string;
  hydrated: boolean;
};

// One store for the Discover rail and the Shows page, which stays pushed above
// it: a location picked on either is the one both show.
let state: NearbyLocationState = {
  mode: "ip",
  zip: "",
  country: "",
  hydrated: false,
};
let hydrating = false;
let changedBeforeHydration = false;
const listeners = new Set<() => void>();

function update(patch: Partial<NearbyLocationState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

function hydrate() {
  if (hydrating) return;
  hydrating = true;
  Promise.all([
    AsyncStorage.getItem(MODE_KEY),
    AsyncStorage.getItem(ZIP_KEY),
    AsyncStorage.getItem(COUNTRY_KEY),
  ])
    .then(([storedMode, storedZip, storedCountry]) => {
      if (changedBeforeHydration) return;
      update({
        mode: storedMode === "zip" ? "zip" : "ip",
        zip: storedZip ?? "",
        country: storedCountry ?? "",
      });
    })
    .catch(() => {})
    .finally(() => update({ hydrated: true }));
}

function persist(key: string, value: string) {
  AsyncStorage.setItem(key, value).catch(() => {});
}

/**
 * Where Shows Near You looks: the server's guess from the request's address
 * ("ip"), or a ZIP or postal code with an optional two-letter country.
 */
export function useNearbyLocationPref() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(hydrate, []);

  const setMode = useCallback((mode: NearbyLocationMode) => {
    changedBeforeHydration = !state.hydrated;
    update({ mode });
    persist(MODE_KEY, mode);
  }, []);

  const setAppliedZip = useCallback((zip: string, country = "") => {
    const next = {
      mode: "zip" as const,
      zip: zip.trim(),
      country: country.trim().toUpperCase(),
    };
    changedBeforeHydration = !state.hydrated;
    update(next);
    persist(MODE_KEY, next.mode);
    persist(ZIP_KEY, next.zip);
    persist(COUNTRY_KEY, next.country);
  }, []);

  return {
    mode: snapshot.mode,
    appliedZip: snapshot.zip,
    appliedCountry: snapshot.country,
    hydrated: snapshot.hydrated,
    setMode,
    setAppliedZip,
  };
}
