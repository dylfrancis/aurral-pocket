jest.mock("@/lib/api/live-socket", () => require("@/test-support/live-socket"));

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDiscoveryUpdates } from "@/hooks/discover/use-discovery-updates";
import { discoverKeys } from "@/lib/query-keys";
import { mockLive } from "@/test-support/live-socket";

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const KEYS = [discoverKeys.discovery(), discoverKeys.madeForYou()];

beforeEach(() => {
  // Infinity schedules no gc timer, which would hold Jest open.
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  for (const key of KEYS) client.setQueryData(key, {});
});

afterEach(() => {
  client.clear();
});

describe("useDiscoveryUpdates", () => {
  it.each([
    ["completed", true],
    // A queued or failed rebuild leaves the old recommendations in place.
    ["queued", false],
    ["error", false],
  ])(
    "on a %s update, refreshes recommendations: %s",
    async (phase, refreshed) => {
      await renderHook(() => useDiscoveryUpdates(), { wrapper });

      await act(async () =>
        mockLive.push({
          channel: "discovery",
          type: "discovery_update",
          isUpdating: !refreshed,
          phase,
        }),
      );

      for (const key of KEYS) {
        expect(client.getQueryState(key)?.isInvalidated).toBe(refreshed);
      }
    },
  );
});
