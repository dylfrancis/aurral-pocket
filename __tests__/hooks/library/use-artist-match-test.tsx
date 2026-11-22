jest.mock("@/lib/api/library", () => ({
  getArtistMatches: jest.fn(),
  setLibraryArtistMbid: jest.fn(),
}));

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMatchArtist } from "@/hooks/library/use-artist-match";
import { setLibraryArtistMbid } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { Artist } from "@/lib/types/library";

const mockSetMbid = setLibraryArtistMbid as jest.Mock;

it("writes the saved match into the artist's cached row before the reread", async () => {
  // Removing a match sends the page back to the Library id. A row still
  // holding the old MBID would open the matched page again.
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: 0 } },
  });
  const key = libraryKeys.canonicalArtist("2");
  client.setQueryData(key, {
    id: "2",
    mbid: "66c662b6-6e2f-4930-8610-912e24c63ed1",
    artistName: "AC/DC",
  } as Artist);
  mockSetMbid.mockResolvedValue({
    id: 2,
    mbid: null,
    name: "AC/DC",
    musicbrainzName: null,
    merged: false,
  });
  const { result } = await renderHook(() => useMatchArtist("2"), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

  await act(async () => {
    await result.current.mutateAsync(null);
  });

  expect(client.getQueryData<Artist>(key)?.mbid).toBe("");
  client.clear();
});
