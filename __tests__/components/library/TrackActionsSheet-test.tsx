jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => () => false,
}));

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  getCanonicalAlbumTracks: jest.fn(),
  getLibraryFavorites: jest.fn(),
}));

jest.mock("@/lib/api/plugins", () => ({
  getPluginActions: jest.fn(),
  runPluginAction: jest.fn(),
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
import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrackActionsSheet } from "@/components/library/TrackActionsSheet";
import {
  getCanonicalAlbumTracks,
  getLibraryFavorites,
} from "@/lib/api/library";
import { getPluginActions, runPluginAction } from "@/lib/api/plugins";
import type { PlayerTrack } from "@/lib/player/track-item";
import type { Track } from "@/lib/types/library";
import type { PluginAction } from "@/lib/types/plugins";

const mockAlbumTracks = getCanonicalAlbumTracks as jest.Mock;
const mockFavorites = getLibraryFavorites as jest.Mock;
const mockGetPluginActions = getPluginActions as jest.Mock;
const mockRunPluginAction = runPluginAction as jest.Mock;

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

/** An album's track whose file is missing, so it has nothing to stream. */
const MISSING_TRACK: Track = {
  id: "76",
  mbid: "",
  trackName: "Airbag",
  title: "Airbag",
  trackNumber: 1,
  hasFile: false,
  size: 0,
  quality: null,
  streamPath: null,
};

const PLAYLIST_JOB: PlayerTrack = {
  ...SEARCH_SONG,
  id: "job-1",
  url: "http://server/api/playlists/stream/job-1?token=token",
  streamPath: "/playlists/stream/job-1",
  albumRef: null,
};

const NOTE_TRACKS: PluginAction = {
  pluginId: "eden",
  pluginName: "Eden",
  id: "track",
  label: "Note these tracks",
  target: "track",
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
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
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
  mockGetPluginActions.mockResolvedValue([NOTE_TRACKS]);
  mockRunPluginAction.mockResolvedValue("Noted");
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

  it.each([
    {
      source: "an album's track with no file, by its Library id",
      target: { track: MISSING_TRACK, album: ALBUM },
      trackId: "76",
    },
    {
      source: "a Library song, by its stream's track",
      target: { item: SEARCH_SONG, album: ALBUM },
      trackId: "77",
    },
  ])("runs a plugin's track action on $source", async ({ target, trackId }) => {
    await render(
      <QueryClientProvider client={client}>
        <TrackActionsSheet target={target} onClose={jest.fn()} />
      </QueryClientProvider>,
    );

    await fireEvent.press(await screen.findByText("Note these tracks"));

    expect(mockRunPluginAction).toHaveBeenCalledWith(NOTE_TRACKS, {
      trackIds: [trackId],
    });
  });

  it("offers no plugin track actions for a playlist's own track", async () => {
    await render(
      <QueryClientProvider client={client}>
        <TrackActionsSheet
          target={{ item: PLAYLIST_JOB, album: ALBUM }}
          onClose={jest.fn()}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Play Next")).toBeTruthy();
    expect(screen.queryByText("Note these tracks")).toBeNull();
  });
});
