jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => () => false,
}));

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  getCanonicalAlbumTracks: jest.fn(),
  getLibraryFavorites: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The sheet's native parts never render here.
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  const React = require("react");
  const BottomSheetModal = React.forwardRef(function BottomSheetModal(
    props: { children: React.ReactNode },
    ref: React.Ref<unknown>,
  ) {
    React.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: jest.fn(),
    }));
    return <View>{props.children}</View>;
  });
  return {
    BottomSheetModal,
    BottomSheetView: View,
    BottomSheetScrollView: View,
    BottomSheetTextInput: View,
    BottomSheetBackdrop: View,
  };
});

jest.mock("@/components/flow/AddToPlaylistSheet", () => ({
  ...jest.requireActual("@/components/flow/AddToPlaylistSheet"),
  AddToPlaylistSheet: () => null,
}));

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrackActionsSheet } from "@/components/library/TrackActionsSheet";
import {
  getCanonicalAlbumTracks,
  getLibraryFavorites,
} from "@/lib/api/library";
import type { PlayerTrack } from "@/lib/player/track-item";

const mockAlbumTracks = getCanonicalAlbumTracks as jest.Mock;
const mockFavorites = getLibraryFavorites as jest.Mock;

/** A Library song as search sends it: no identity key to favorite it by. */
const SEARCH_SONG: PlayerTrack = {
  id: "77",
  title: "Karma Police",
  artist: "Radiohead",
  album: "OK Computer",
  duration: 0,
  url: "http://server/api/library/stream/12/77?token=token",
  artwork: null,
  streamPath: "/library/stream/12/77",
  coverPath: null,
  trackMbid: null,
  artistMbid: null,
  albumMbid: null,
  favorite: null,
  albumRef: "12",
};

const ALBUM = {
  albumTitle: "OK Computer",
  artistName: "Radiohead",
  coverPath: null,
  artworkUrl: null,
  albumMbid: null,
  artistMbid: null,
};

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  mockAlbumTracks.mockResolvedValue([
    { id: "76", identityKey: "song:airbag" },
    { id: "77", identityKey: "song:karma-police" },
  ]);
  mockFavorites.mockResolvedValue({
    artists: [],
    albums: [],
    tracks: [],
    playlistSongIds: [],
  });
});

afterEach(() => client.clear());

describe("TrackActionsSheet", () => {
  it("offers a Library song's favorite from its album when the song carries no key", async () => {
    await render(
      <QueryClientProvider client={client}>
        <TrackActionsSheet
          target={{ item: SEARCH_SONG, album: ALBUM }}
          onClose={jest.fn()}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Add to Favorites")).toBeTruthy();
    expect(mockAlbumTracks).toHaveBeenCalledWith("12");
  });
});
