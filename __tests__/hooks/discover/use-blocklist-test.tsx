jest.mock("@/lib/api/discover", () => ({
  getBlocklist: jest.fn(),
  updateBlocklist: jest.fn(),
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getBlocklist, updateBlocklist } from "@/lib/api/discover";
import {
  useBlocklist,
  useBlocklistMutations,
  useIsArtistBlocked,
} from "@/hooks/discover/use-blocklist";
import { discoverKeys } from "@/lib/query-keys";
import type { Blocklist } from "@/lib/types/discover";

const mockGetBlocklist = getBlocklist as jest.Mock;
const mockUpdateBlocklist = updateBlocklist as jest.Mock;

const MBID_A = "11111111-1111-1111-1111-111111111111";
const MBID_B = "22222222-2222-2222-2222-222222222222";

function makeWrapper(initial?: Blocklist) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (initial) {
    client.setQueryData(discoverKeys.blocklist(), initial);
  }
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { wrapper: Wrapper, client };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useBlocklist", () => {
  it("fetches from getBlocklist and returns the data", async () => {
    const data: Blocklist = {
      artists: [{ mbid: MBID_A, name: "Foo" }],
      tags: ["pop"],
    };
    mockGetBlocklist.mockResolvedValue(data);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBlocklist(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
  });
});

describe("useIsArtistBlocked", () => {
  it("returns blocked=false and loaded=false before data resolves", () => {
    mockGetBlocklist.mockReturnValue(new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIsArtistBlocked(MBID_A, "Foo"), {
      wrapper,
    });
    expect(result.current).toEqual({ blocked: false, loaded: false });
  });

  it("reports blocked=true once cached data shows the artist", async () => {
    const { wrapper } = makeWrapper({
      artists: [{ mbid: MBID_A, name: "Foo" }],
      tags: [],
    });
    mockGetBlocklist.mockResolvedValue({
      artists: [{ mbid: MBID_A, name: "Foo" }],
      tags: [],
    });

    const { result } = renderHook(() => useIsArtistBlocked(MBID_A, "Foo"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.blocked).toBe(true);
  });
});

describe("useBlocklistMutations — optimistic update", () => {
  it("flips cache immediately on toggleArtist (add) before server resolves", async () => {
    const initial: Blocklist = { artists: [], tags: [] };
    const { wrapper, client } = makeWrapper(initial);

    let resolveUpdate: ((v: Blocklist) => void) | undefined;
    mockUpdateBlocklist.mockImplementation(
      () => new Promise<Blocklist>((r) => (resolveUpdate = r)),
    );

    const { result } = renderHook(() => useBlocklistMutations(), { wrapper });

    act(() => {
      result.current.toggleArtist({ mbid: MBID_A, name: "Foo" });
    });

    // optimistic flip happens synchronously inside onMutate
    await waitFor(() => {
      expect(client.getQueryData<Blocklist>(discoverKeys.blocklist())).toEqual({
        artists: [{ mbid: MBID_A, name: "Foo" }],
        tags: [],
      });
    });

    act(() => {
      resolveUpdate?.({
        artists: [{ mbid: MBID_A, name: "Foo" }],
        tags: [],
      });
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it("rolls back the cache when updateBlocklist rejects", async () => {
    const initial: Blocklist = {
      artists: [{ mbid: MBID_A, name: "Foo" }],
      tags: ["pop"],
    };
    const { wrapper, client } = makeWrapper(initial);

    mockUpdateBlocklist.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useBlocklistMutations(), { wrapper });

    act(() => {
      result.current.toggleArtist({ mbid: MBID_B, name: "Bar" });
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(client.getQueryData<Blocklist>(discoverKeys.blocklist())).toEqual(
      initial,
    );
  });

  it("addTag is a no-op when tag is already present", async () => {
    const initial: Blocklist = { artists: [], tags: ["pop"] };
    const { wrapper, client } = makeWrapper(initial);

    mockUpdateBlocklist.mockResolvedValue(initial);

    const { result } = renderHook(() => useBlocklistMutations(), { wrapper });

    act(() => result.current.addTag("POP"));

    // PUT still fires (mutation runs); the cache stays the same because
    // applyVariables is idempotent for duplicates.
    await waitFor(() =>
      expect(client.getQueryData(discoverKeys.blocklist())).toEqual(initial),
    );
  });

  it("toggleArtist on an already-blocked artist removes it from the cache", async () => {
    const initial: Blocklist = {
      artists: [{ mbid: MBID_A, name: "Foo" }],
      tags: [],
    };
    const { wrapper, client } = makeWrapper(initial);

    mockUpdateBlocklist.mockResolvedValue({ artists: [], tags: [] });

    const { result } = renderHook(() => useBlocklistMutations(), { wrapper });

    act(() => result.current.toggleArtist({ mbid: MBID_A, name: "Foo" }));

    await waitFor(() => {
      const cache = client.getQueryData<Blocklist>(discoverKeys.blocklist());
      expect(cache?.artists).toEqual([]);
    });
  });

  it("removeArtist filters the entry without re-adding", async () => {
    const initial: Blocklist = {
      artists: [
        { mbid: MBID_A, name: "Gone" },
        { mbid: MBID_B, name: "Stays" },
      ],
      tags: [],
    };
    const { wrapper, client } = makeWrapper(initial);

    mockUpdateBlocklist.mockImplementation(async (next: Blocklist) => next);

    const { result } = renderHook(() => useBlocklistMutations(), { wrapper });

    act(() => result.current.removeArtist({ mbid: MBID_A, name: "Gone" }));

    await waitFor(() => {
      const cache = client.getQueryData<Blocklist>(discoverKeys.blocklist());
      expect(cache?.artists).toEqual([{ mbid: MBID_B, name: "Stays" }]);
    });
  });
});
