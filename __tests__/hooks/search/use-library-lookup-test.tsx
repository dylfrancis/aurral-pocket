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

const mockLookupLibraryArtists = lookupLibraryArtists as jest.Mock;

const clients: QueryClient[] = [];

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
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
