import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppStorage } from "@/lib/storage";
import type { LibraryStatus } from "@/lib/types/library";

/** What a Library list shows: everything, favorites, or what's saved offline. */
export type LibraryShow = "all" | "favorites" | "saved";

/** One list's sort and filters, as the user left them. */
export type LibraryView<Sort extends string> = {
  sort: Sort;
  show: LibraryShow;
  status: LibraryStatus | null;
};

const STATUSES: readonly LibraryStatus[] = [
  "monitored",
  "unmonitored",
  "missing",
];

// In-memory mirror of the stored views, so a list mounts with its own view
// once the first read has finished.
let cache: Record<string, unknown> | null = null;
let pendingLoad: Promise<Record<string, unknown>> | null = null;

function loadViews(): Promise<Record<string, unknown>> {
  if (cache) return Promise.resolve(cache);
  pendingLoad ??= AppStorage.getLibraryViews().then((stored) => {
    cache = stored;
    return stored;
  });
  return pendingLoad;
}

/**
 * Read the stored views ahead of time. A list opened before the read finishes
 * starts on its defaults and switches when it does.
 */
export function preloadLibraryViews() {
  void loadViews();
}

/** Anything the list no longer offers falls back to its default. */
function readView<Sort extends string>(
  stored: unknown,
  sorts: readonly Sort[],
  shows: readonly LibraryShow[],
): LibraryView<Sort> {
  const value =
    stored && typeof stored === "object"
      ? (stored as Partial<Record<keyof LibraryView<Sort>, unknown>>)
      : {};
  return {
    sort: sorts.find((sort) => sort === value.sort) ?? sorts[0],
    show: shows.find((show) => show === value.show) ?? "all",
    status: STATUSES.find((status) => status === value.status) ?? null,
  };
}

/**
 * A Library list's sort and filters, remembered under `listKey` across
 * launches. `sorts` is every sort the list can offer, its default first.
 *
 * `openedSort` opens the list on that sort with no filters, without changing
 * the remembered view.
 *
 * Changes render in a transition, so a list read with Suspense keeps showing
 * the old view until the new one has loaded.
 */
export function useLibraryView<Sort extends string>(
  listKey: string,
  sorts: readonly Sort[],
  shows: readonly LibraryShow[],
  openedSort?: Sort,
) {
  const [view, setView] = useState<LibraryView<Sort>>(() =>
    openedSort
      ? { sort: openedSort, show: "all", status: null }
      : readView(cache?.[listKey], sorts, shows),
  );
  // The newest view asked for. `view` lags behind it while a Suspense list
  // loads in the transition, and a second change must build on the first.
  const latest = useRef(view);
  const changedByUser = useRef(false);

  // `sorts` and `shows` are fixed per list, so only the key reloads.
  useEffect(() => {
    if (openedSort) return;
    let cancelled = false;
    void loadViews().then((stored) => {
      // A change made before the read finished is newer than what's stored.
      if (cancelled || changedByUser.current) return;
      if (stored[listKey] === undefined) return;
      const restored = readView(stored[listKey], sorts, shows);
      latest.current = restored;
      startTransition(() => setView(restored));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  const update = useCallback(
    (change: Partial<LibraryView<Sort>>) => {
      const next = { ...latest.current, ...change };
      latest.current = next;
      changedByUser.current = true;
      startTransition(() => setView(next));
      void loadViews().then((stored) => {
        stored[listKey] = next;
        void AppStorage.setLibraryViews(stored);
      });
    },
    [listKey],
  );

  const setSort = useCallback((sort: Sort) => update({ sort }), [update]);
  const setShow = useCallback(
    (show: LibraryShow) => update({ show }),
    [update],
  );
  const setStatus = useCallback(
    (status: LibraryStatus | null) => update({ status }),
    [update],
  );

  return { view, setSort, setShow, setStatus };
}

/**
 * A value of any shape kept beside the list views under `listKey`. Only the
 * key reloads it, so define `parse` outside the component.
 */
export function useRememberedListValue<T>(
  listKey: string,
  parse: (stored: unknown) => T,
) {
  const [value, setValue] = useState<T>(() => parse(cache?.[listKey]));
  const changedByUser = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadViews().then((stored) => {
      // A change made before the read finished is newer than what's stored.
      if (cancelled || changedByUser.current) return;
      if (stored[listKey] === undefined) return;
      setValue(parse(stored[listKey]));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  const update = useCallback(
    (next: T) => {
      changedByUser.current = true;
      setValue(next);
      void loadViews().then((stored) => {
        stored[listKey] = next;
        void AppStorage.setLibraryViews(stored);
      });
    },
    [listKey],
  );

  return [value, update] as const;
}

/** A list's sorts for what it shows: Recently Favorited only on favorites. */
export function sortsFor<Option extends { key: string }>(
  options: readonly Option[],
  show: LibraryShow,
): Option[] {
  return show === "favorites"
    ? [...options]
    : options.filter((option) => option.key !== "favorited");
}

/** The user's sort when the list offers it, or else the list's default. */
export function offeredSort<Sort extends string>(
  options: readonly { key: Sort }[],
  sort: string,
): Sort {
  return (options.find((option) => option.key === sort) ?? options[0]).key;
}
