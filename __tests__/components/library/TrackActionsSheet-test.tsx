// None unless a test grants some.
const mockPermissions = new Set<string>();
jest.mock("@/hooks/auth/use-has-permission", () => ({
  useHasPermission: () => (permission: string) =>
    mockPermissions.has(permission),
}));

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  deleteLibraryTrack: jest.fn(),
  getCanonicalAlbumTracks: jest.fn(),
  getLibraryFavorites: jest.fn(),
}));

jest.mock("@/lib/player/player", () => ({
  ...jest.requireActual("@/lib/player/player"),
  removeLibraryTrackFromQueue: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/offline/saved-library", () => ({
  ...jest.requireActual("@/lib/offline/saved-library"),
  removeSaved: jest.fn(() => Promise.resolve()),
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
import { Alert, type AlertButton } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { TrackActionsSheet } from "@/components/library/TrackActionsSheet";
import { ApiError } from "@/lib/api/client";
import {
  deleteLibraryTrack,
  getCanonicalAlbumTracks,
  getLibraryFavorites,
} from "@/lib/api/library";
import { getPluginActions, runPluginAction } from "@/lib/api/plugins";
import { removeSaved } from "@/lib/offline/saved-library";
import { removeLibraryTrackFromQueue } from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";
import { libraryKeys } from "@/lib/query-keys";
import type { Track } from "@/lib/types/library";
import type { PluginAction } from "@/lib/types/plugins";

const mockDeleteLibraryTrack = deleteLibraryTrack as jest.Mock;
const mockRemoveFromQueue = removeLibraryTrackFromQueue as jest.Mock;
const mockRemoveSaved = removeSaved as jest.Mock;
const mockToast = Burnt.toast as jest.Mock;
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
  jest.clearAllMocks();
  mockPermissions.clear();
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

describe("Delete from Library", () => {
  /** An album's song that Aurral downloaded itself. */
  const DOWNLOADED: Track = {
    id: "77",
    mbid: "",
    trackName: "Karma Police",
    title: "Karma Police",
    trackNumber: 6,
    hasFile: true,
    size: 0,
    quality: "FLAC",
    streamPath: "/library/stream/12/77",
    sources: ["aurral"],
  };

  async function renderSheet(
    target: Parameters<typeof TrackActionsSheet>[0]["target"],
    onDeleted = jest.fn(),
  ) {
    await render(
      <QueryClientProvider client={client}>
        <TrackActionsSheet
          target={target}
          onClose={jest.fn()}
          onDeleted={onDeleted}
        />
      </QueryClientProvider>,
    );
    return onDeleted;
  }

  /** Holds the confirmation open, and hands back its Delete button. */
  function holdConfirmation() {
    let confirm: AlertButton | undefined;
    jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        confirm = buttons?.find((button) => button.style === "destructive");
      });
    return () => confirm?.onPress?.();
  }

  afterEach(() => jest.restoreAllMocks());

  it.each([
    {
      song: "an album's song Aurral downloaded",
      target: { track: DOWNLOADED, album: ALBUM },
      permissions: ["deleteTrack"],
      offered: true,
    },
    {
      // The server takes either permission, as the web does.
      song: "a downloaded song, to someone who may delete albums",
      target: { track: DOWNLOADED, album: ALBUM },
      permissions: ["deleteAlbum"],
      offered: true,
    },
    {
      song: "a downloaded song, to someone who may delete neither",
      target: { track: DOWNLOADED, album: ALBUM },
      permissions: [],
      offered: false,
    },
    {
      // Aurral refuses it with a 409 and keeps the file.
      song: "a song only in a read-only folder",
      target: {
        track: { ...DOWNLOADED, sources: ["readonly" as const] },
        album: ALBUM,
      },
      permissions: ["deleteTrack"],
      offered: false,
    },
    {
      song: "a search song its album says Aurral downloaded",
      target: { item: SEARCH_SONG, album: ALBUM },
      permissions: ["deleteTrack"],
      offered: true,
    },
  ])(
    "offers it for $song: $offered",
    async ({ target, permissions, offered }) => {
      permissions.forEach((permission) => mockPermissions.add(permission));
      mockAlbumTracks.mockResolvedValue([DOWNLOADED]);
      await renderSheet(target);

      if (offered) {
        expect(await screen.findByText("Delete from Library")).toBeTruthy();
      } else {
        expect(await screen.findByText("Play Next")).toBeTruthy();
        expect(screen.queryByText("Delete from Library")).toBeNull();
      }
    },
  );

  it("deletes the song once confirmed, and takes it out of the queue, off the phone and out of the lists", async () => {
    mockPermissions.add("deleteTrack");
    mockDeleteLibraryTrack.mockResolvedValue({ success: true });
    client.setQueryData(libraryKeys.tracks("12"), [DOWNLOADED]);
    const confirm = holdConfirmation();
    const onDeleted = await renderSheet({ track: DOWNLOADED, album: ALBUM });

    await fireEvent.press(screen.getByText("Delete from Library"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Delete from Library",
      `Delete "Karma Police" and its file? Aurral won't download it again.`,
      expect.any(Array),
    );
    expect(mockDeleteLibraryTrack).not.toHaveBeenCalled();

    await act(async () => confirm());

    expect(mockDeleteLibraryTrack).toHaveBeenCalledWith("77");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Deleted Karma Police" }),
    );
    expect(mockRemoveFromQueue).toHaveBeenCalledWith("77");
    expect(mockRemoveSaved).toHaveBeenCalledWith("song", "77");
    expect(client.getQueryState(libraryKeys.tracks("12"))?.isInvalidated).toBe(
      true,
    );
    expect(onDeleted).toHaveBeenCalled();
  });

  it("says why when Aurral refuses, and leaves the queue alone", async () => {
    mockPermissions.add("deleteTrack");
    const refusal =
      "This file is in a read-only folder, so Aurral did not delete it. Remove it from the folder yourself.";
    mockDeleteLibraryTrack.mockRejectedValue(new ApiError(409, refusal));
    const confirm = holdConfirmation();
    const onDeleted = await renderSheet({ track: DOWNLOADED, album: ALBUM });

    await fireEvent.press(screen.getByText("Delete from Library"));
    await act(async () => confirm());

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't delete Karma Police",
        message: refusal,
        preset: "error",
      }),
    );
    expect(mockRemoveFromQueue).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
