import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "recent_searches";
const MAX_RECENT = 10;

export type RecentSearch =
  | { type: "query"; text: string }
  | { type: "artist"; text: string; mbid: string }
  | { type: "tag"; text: string };

function migrate(raw: unknown): RecentSearch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): RecentSearch | null => {
      if (typeof item === "object" && item !== null && "type" in item)
        return item as RecentSearch;
      if (typeof item === "string") {
        if (item.startsWith("#")) return { type: "tag", text: item.slice(1) };
        return { type: "query", text: item };
      }
      return null;
    })
    .filter((x): x is RecentSearch => x !== null);
}

function matches(a: RecentSearch, b: RecentSearch): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "artist" && b.type === "artist") return a.mbid === b.mbid;
  return a.text === b.text;
}

export function useRecentSearches() {
  const [searches, setSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setSearches(migrate(JSON.parse(raw)));
        } catch {}
      }
    });
  }, []);

  const persist = useCallback((next: RecentSearch[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const add = useCallback(
    (entry: RecentSearch) => {
      setSearches((prev) => {
        const filtered = prev.filter((s) => !matches(s, entry));
        const next = [entry, ...filtered].slice(0, MAX_RECENT);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const remove = useCallback(
    (entry: RecentSearch) => {
      setSearches((prev) => {
        const next = prev.filter((s) => !matches(s, entry));
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clear = useCallback(async () => {
    setSearches([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return { searches, add, remove, clear };
}
