jest.mock("@/hooks/library/use-library-albums", () => ({
  useLibraryAlbums: jest.fn(),
}));

jest.mock("@/hooks/library/use-artist-details-stream", () => ({
  useArtistDetailsStream: jest.fn(),
}));

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

jest.mock("@/components/player/MiniPlayerHost", () => ({
  MiniPlayerHost: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ serverUrl: "http://server", token: "token" }),
}));

jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderRouter, screen } from "expo-router/testing-library";
import LibraryLayout from "@/app/(app)/(tabs)/(library)/_layout";
import ReleasesRoute from "@/app/(app)/(tabs)/(library)/artist/releases";
import { useArtistDetailsStream } from "@/hooks/library/use-artist-details-stream";
import { useLibraryAlbums } from "@/hooks/library/use-library-albums";
import type { ReleaseGroup, SecondaryReleaseType } from "@/lib/types/library";

const mockUseArtistDetailsStream = useArtistDetailsStream as jest.Mock;
const mockUseLibraryAlbums = useLibraryAlbums as jest.Mock;

function album(
  title: string,
  date: string,
  listeners: number,
  secondary: SecondaryReleaseType[] = [],
): ReleaseGroup {
  return {
    id: title,
    title,
    "first-release-date": date,
    "primary-type": "Album",
    "secondary-types": secondary,
    listenerCount: listeners,
  };
}

const RELEASES = [
  album("Older", "2005-01-01", 40),
  album("Studio", "2020-01-01", 10),
  album("Hits", "2010-01-01", 90, ["Compilation"]),
  album("Owned", "2022-01-01", 500),
];

const shownTitles = () =>
  screen
    .getAllByText(/^(Older|Studio|Hits|Owned)$/)
    .map((title) => title.props.children);

const OtherRoute = () => null;

async function openRow(albumType: string) {
  mockUseArtistDetailsStream.mockReturnValue({
    data: { releaseGroups: RELEASES, isComplete: true },
    isLoading: false,
  });
  mockUseLibraryAlbums.mockReturnValue({
    data: [{ mbid: "Owned", foreignAlbumId: "Owned" }],
    isLoading: false,
    refetch: jest.fn(),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await renderRouter(
    {
      _layout: LibraryLayout,
      "artist/releases": ReleasesRoute,
      // The layout's other screens, so it finds every route it names.
      index: OtherRoute,
      artists: OtherRoute,
      albums: OtherRoute,
      favorites: OtherRoute,
      genres: OtherRoute,
      "genre/[genre]": OtherRoute,
      blocklist: OtherRoute,
      playlists: OtherRoute,
      "playlist-edit": OtherRoute,
      "artist/[mbid]": OtherRoute,
      "artist/albums": OtherRoute,
      "album/[ref]": OtherRoute,
      "release/[mbid]": OtherRoute,
    },
    {
      initialUrl: `/artist/releases?artistMbid=abc-123&artistName=Test&albumType=${albumType}`,
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}

describe("a release row's full list", () => {
  it("lists a row newest first, leaving out compilations and library albums", async () => {
    await openRow("Album");

    await screen.findByText("Studio");
    expect(shownTitles()).toEqual(["Studio", "Older"]);
  });

  it("lists that compilation under Compilations", async () => {
    await openRow("Compilation");

    await screen.findByText("Hits");
    expect(shownTitles()).toEqual(["Hits"]);
  });
});
