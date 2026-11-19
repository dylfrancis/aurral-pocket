jest.mock("@/lib/api/live-socket", () => require("@/test-support/live-socket"));

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLibraryUpdates } from "@/hooks/library/use-library-updates";
import { discoverKeys, libraryKeys } from "@/lib/query-keys";
import { mockLive } from "@/test-support/live-socket";

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const KEYS = {
  library: libraryKeys.artists(),
  // Downloads trigger scans, so metadata mustn't refetch on each one.
  artistDetails: libraryKeys.artistDetails(
    "a74b1b7f-71a5-4011-9441-d0b5e4122711",
  ),
  recentlyAdded: discoverKeys.recentlyAdded(),
  recentReleases: discoverKeys.recentReleases(),
};

beforeEach(() => {
  // Infinity schedules no gc timer, which would hold Jest open.
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  for (const key of Object.values(KEYS)) client.setQueryData(key, []);
});

afterEach(() => {
  client.clear();
});

describe("useLibraryUpdates", () => {
  it.each([
    ["library_scan_completed", ["library", "recentlyAdded"]],
    ["release_metadata_refreshed", ["recentReleases"]],
  ])("refreshes what %s changes", async (type, refreshed) => {
    await renderHook(() => useLibraryUpdates(), { wrapper });

    await act(async () => mockLive.push({ channel: "library", type }));

    const invalidated = Object.entries(KEYS)
      .filter(([, key]) => client.getQueryState(key)?.isInvalidated)
      .map(([name]) => name);
    expect(invalidated).toEqual(refreshed);
  });
});
