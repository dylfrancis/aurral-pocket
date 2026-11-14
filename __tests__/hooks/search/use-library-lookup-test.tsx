jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    serverUrl: "https://aurral.example",
    token: "test-token",
  }),
}));

jest.mock("@/lib/api/library", () => ({
  lookupLibraryArtists: jest.fn(),
}));

import React from "react";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lookupLibraryArtists } from "@/lib/api/library";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { libraryKeys } from "@/lib/query-keys";

const mockLookupLibraryArtists = lookupLibraryArtists as jest.Mock;

const clients: QueryClient[] = [];

function makeClient(queries = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, ...queries } },
  });
  clients.push(client);
  return client;
}

function makeWrapper(client = makeClient()) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("useLibraryLookup", () => {
  it("marks the artists the lookup reports in the library once it answers", async () => {
    let answer!: (batch: Record<string, boolean>) => void;
    mockLookupLibraryArtists.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    const { result } = await renderHook(
      () => useLibraryLookup(["mb-b", "mb-a"]),
      { wrapper: makeWrapper() },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isInLibrary("mb-a")).toBe(false);

    await act(async () => answer({ "mb-a": true, "mb-b": false }));
    await waitFor(() => expect(result.current.isInLibrary("mb-a")).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isInLibrary("mb-b")).toBe(false);
    expect(result.current.isInLibrary("mb-unknown")).toBe(false);
  });

  it("stops loading when the lookup fails, leaving the artist unmarked", async () => {
    // A screen waiting on the answer must not wait forever.
    mockLookupLibraryArtists.mockRejectedValue(new Error("offline"));

    const { result } = await renderHook(() => useLibraryLookup(["mb-a"]), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isInLibrary("mb-a")).toBe(false);
  });

  it("shares one lookup per set of MBIDs, whatever the order, duplicates or blanks", async () => {
    // Discover's sections and its full lists pass the same list in different
    // shapes; they must not each send a request.
    mockLookupLibraryArtists.mockResolvedValue({ "mb-a": true, "mb-b": true });
    const wrapper = makeWrapper();

    const { result } = await renderHook(
      () => ({
        section: useLibraryLookup(["mb-b", null, "mb-a", "mb-b"]),
        list: useLibraryLookup(["mb-a", "mb-b"]),
      }),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.list.isInLibrary("mb-a")).toBe(true),
    );
    expect(result.current.section.isInLibrary("mb-b")).toBe(true);
    expect(mockLookupLibraryArtists).toHaveBeenCalledTimes(1);
    expect(mockLookupLibraryArtists).toHaveBeenCalledWith(["mb-a", "mb-b"]);
  });
});

describe("useLibraryLookup seeded from cached lookups", () => {
  // As the app runs: answers kept for five minutes, and seeds not collected
  // before the hook mounts.
  const seededClient = () =>
    makeClient({ gcTime: Infinity, staleTime: 5 * 60 * 1000 });

  it("asks the server when cached lookups cover only some of the artists", async () => {
    // An artist no lookup answered must not read as outside the library.
    const client = seededClient();
    client.setQueryData(libraryKeys.artistLookup("mb-a"), { "mb-a": true });
    mockLookupLibraryArtists.mockResolvedValue({ "mb-a": true, "mb-b": true });

    const { result } = await renderHook(
      () => useLibraryLookup(["mb-a", "mb-b"]),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.isInLibrary("mb-b")).toBe(true));
    expect(mockLookupLibraryArtists).toHaveBeenCalledWith(["mb-a", "mb-b"]);
  });

  it("answers at once from an old lookup, then asks again", async () => {
    const client = seededClient();
    client.setQueryData(
      libraryKeys.artistLookup("mb-a,mb-b"),
      { "mb-a": true, "mb-b": false },
      { updatedAt: Date.now() - 10 * 60 * 1000 },
    );
    let answer!: (batch: Record<string, boolean>) => void;
    mockLookupLibraryArtists.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    const { result } = await renderHook(() => useLibraryLookup(["mb-a"]), {
      wrapper: makeWrapper(client),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isInLibrary("mb-a")).toBe(true);
    expect(mockLookupLibraryArtists).toHaveBeenCalledWith(["mb-a"]);

    await act(async () => answer({ "mb-a": false }));
    await waitFor(() => expect(result.current.isInLibrary("mb-a")).toBe(false));
  });
});
