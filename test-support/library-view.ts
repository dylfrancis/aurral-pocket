// useLibraryView without storage, for
// `jest.mock("@/hooks/library/use-library-view", () => require("@/test-support/library-view"))`.
// The real hook keeps every list's view in memory for the whole run, so a
// sort one test picks would carry into the next. Each mount here starts on
// the list's defaults. The storage itself is tested in use-library-view-test.
import { useState } from "react";
import type {
  LibraryShow,
  LibraryView,
} from "@/hooks/library/use-library-view";
import type { LibraryStatus } from "@/lib/types/library";

const actual = jest.requireActual<
  typeof import("@/hooks/library/use-library-view")
>("@/hooks/library/use-library-view");

export const { sortsFor, offeredSort, preloadLibraryViews } = actual;
export type { LibraryShow, LibraryView };

export function useLibraryView<Sort extends string>(
  _listKey: string,
  sorts: readonly Sort[],
) {
  const [view, setView] = useState<LibraryView<Sort>>({
    sort: sorts[0],
    show: "all",
    status: null,
  });
  return {
    view,
    setSort: (sort: Sort) => setView((current) => ({ ...current, sort })),
    setShow: (show: LibraryShow) =>
      setView((current) => ({ ...current, show })),
    setStatus: (status: LibraryStatus | null) =>
      setView((current) => ({ ...current, status })),
  };
}
