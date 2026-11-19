// Online unless a test takes the connection away.
let mockOffline = false;
jest.mock("@/lib/offline/network", () => ({
  isOffline: () => mockOffline,
  useIsOffline: () => mockOffline,
  networkKnown: () => Promise.resolve(),
  onNetworkChange: () => () => {},
  isMetered: () => false,
  onMeteredChange: () => () => {},
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Reanimated's shipped mock fails to load under jest-expo. This stand-in renders
// every animated view at rest.
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  const AnimatedView = React.forwardRef(function AnimatedView(
    { entering, layout, ...props }: any,
    ref: any,
  ) {
    return React.createElement(View, { ...props, ref });
  });
  const fade = { duration: () => fade };
  return {
    __esModule: true,
    default: { View: AnimatedView },
    Easing: { bezier: () => (t: number) => t },
    Extrapolation: { CLAMP: "clamp" },
    FadeIn: fade,
    ReduceMotion: { System: "system" },
    LayoutAnimationConfig: ({ children }: any) => children,
    interpolate: (_value: number, _input: number[], output: number[]) =>
      output[0],
    useSharedValue: (initial: number) => {
      let current = initial;
      return { get: () => current, set: (next: number) => (current = next) };
    },
    useAnimatedStyle: (fn: () => object) => fn(),
    useReducedMotion: () => false,
    withTiming: (target: number) => target,
    withSpring: (target: number) => target,
  };
});
jest.mock("react-native-worklets", () => ({ scheduleOnRN: jest.fn() }));
// The drag to close needs a real gesture system, so it is checked on a device.
jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({ children }: any) => children,
  GestureDetector: ({ children }: any) => children,
  usePanGesture: () => ({}),
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModalProvider: ({ children }: any) => children,
}));

const mockOpenAddToPlaylist = jest.fn();
jest.mock("@/components/flow/AddToPlaylistSheet", () => ({
  useAddToPlaylist: () => ({
    canAddToPlaylist: true,
    track: null,
    open: mockOpenAddToPlaylist,
    close: jest.fn(),
  }),
  AddToPlaylistSheet: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    navigate: mockNavigate,
    back: mockBack,
    dismissTo: mockDismissTo,
  })),
}));

/**
 * iOS closes the player and navigates. On Android, Activity or Settings can
 * sit between the player and the tabs, so it pops down to the tabs instead.
 */
function expectLeftFor(href: unknown) {
  if (IS_ANDROID) {
    expect(mockDismissTo).toHaveBeenCalledWith(href);
    expect(mockNavigate).not.toHaveBeenCalled();
  } else {
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(href);
  }
}

// The queue another device left, as the sync lists it.
let mockOtherDevice: unknown = null;
const mockPickUpQueue = jest.fn(() => Promise.resolve());
jest.mock("@/lib/player/queue-sync", () => ({
  useOtherDevice: () => mockOtherDevice,
  pickUpQueue: () => mockPickUpQueue(),
  forgetQueueSync: () => Promise.resolve(),
}));

jest.mock("@/lib/api/lyrics", () => ({ getLyrics: jest.fn() }));

jest.mock("@/lib/api/plugins", () => ({
  getPluginActions: jest.fn(),
  runPluginAction: jest.fn(),
}));

const mockGetLibraryRadio = jest.fn((..._args: unknown[]) =>
  Promise.resolve<LibraryQueueTrack[]>([]),
);
jest.mock("@/lib/api/radio", () => ({
  getLibraryRadio: (...args: unknown[]) => mockGetLibraryRadio(...args),
}));

// The switch is SwiftUI or Compose; it stands in as a pressable switch.
jest.mock("@/components/settings/SettingsSwitch", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    SettingsSwitch: ({ value, onChange, accessibilityLabel }: any) =>
      React.createElement(Pressable, {
        accessibilityRole: "switch",
        accessibilityLabel,
        accessibilityState: { checked: value },
        onPress: () => onChange(!value),
      }),
  };
});

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  getCanonicalAlbumTracks: jest.fn(),
  getLibraryFavorites: jest.fn(),
  updateLibraryFavorites: jest.fn(),
}));

// The community slider ships no Jest mock; a plain View exposes the same
// callback props to fireEvent.
jest.mock("@react-native-community/slider", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockSlider(props: any) {
    return React.createElement(View, { ...props, testID: "scrubber-slider" });
  };
});

import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NowPlayingScreen } from "@/components/player/NowPlayingScreen";
import { IS_ANDROID } from "@/constants/platform";
import { NowPlayingProvider } from "@/contexts/now-playing-context";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import {
  getCanonicalAlbumTracks,
  getLibraryFavorites,
  updateLibraryFavorites,
} from "@/lib/api/library";
import { getLyrics } from "@/lib/api/lyrics";
import { getPluginActions, runPluginAction } from "@/lib/api/plugins";
import {
  onTrackStarted,
  playAlbumFromTrack,
  playQueueFrom,
  setRepeatMode,
  setShuffle,
} from "@/lib/player/player";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  setPlaybackSettings,
} from "@/lib/player/playback-settings";
import {
  queueTrackToPlayerTrack,
  type PlayerTrack,
} from "@/lib/player/track-item";
import type { LibraryQueueTrack, Track } from "@/lib/types/library";
import * as Burnt from "burnt";
import {
  forgetSavedLibrary,
  setSavedLibraryUser,
} from "@/lib/offline/saved-library";
import { downloads } from "@/test-support/expo-file-system";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;
const mockGetLibraryFavorites = getLibraryFavorites as jest.Mock;
const mockGetCanonicalAlbumTracks = getCanonicalAlbumTracks as jest.Mock;
const mockUpdateLibraryFavorites = updateLibraryFavorites as jest.Mock;
const mockGetLyrics = getLyrics as jest.Mock;
const mockGetPluginActions = getPluginActions as jest.Mock;
const mockRunPluginAction = runPluginAction as jest.Mock;

function track(id: string, name: string): Track {
  return {
    id,
    mbid: `mb-${id}`,
    trackName: name,
    title: name,
    trackNumber: Number(id),
    hasFile: true,
    size: 9_000_000,
    quality: "FLAC",
    streamPath: `/stream/12/${id}`,
    streamFormat: "flac",
    bitrateKbps: 1042,
    available: true,
  };
}

const album = {
  albumTitle: "Kid A",
  artistName: "Radiohead",
  coverPath: null,
  artworkUrl: "https://art.example/kid-a.jpg",
  albumMbid: "album-mb-1",
  artistMbid: "artist-mb-1",
  albumRef: "canonical-album-1",
};

const albumTracks = [
  track("1", "Everything In Its Right Place"),
  track("2", "Kid A"),
  track("3", "The National Anthem"),
];

function favoritesWith(...tracks: Partial<Track>[]) {
  return { artists: [], albums: [], tracks, playlistSongIds: [] };
}

let engine: {
  trackChange: Parameters<typeof manager.subscribeToTrackChange>[0];
  progress: Parameters<typeof manager.subscribeToPlaybackProgressChange>[0];
  stateChange: Parameters<typeof manager.subscribeToPlaybackState>[0];
};

beforeAll(() => {
  onTrackStarted(() => {})();
  engine = {
    trackChange: manager.subscribeToTrackChange.mock.calls[0][0],
    progress: manager.subscribeToPlaybackProgressChange.mock.calls[0][0],
    stateChange: manager.subscribeToPlaybackState.mock.calls[0][0],
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOtherDevice = null;
  setBaseUrl("https://test.example");
  setAuthToken("test-token-123");
  queue.createPlaylist.mockResolvedValue("playlist-1");
  mockGetLibraryFavorites.mockResolvedValue(favoritesWith());
  mockGetCanonicalAlbumTracks.mockResolvedValue([]);
  mockUpdateLibraryFavorites.mockResolvedValue({ changedIds: [] });
  mockGetLyrics.mockResolvedValue(null);
  mockGetPluginActions.mockResolvedValue([]);
});

// The player keeps its track between tests, so even a first render can show the
// favorite button, which needs a query client. The providers outlive the
// player, as the app's do, so it can close and reopen.
async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const app = (playerOpen: boolean) => (
    <QueryClientProvider client={client}>
      <NowPlayingProvider>
        {playerOpen ? <NowPlayingScreen /> : null}
      </NowPlayingProvider>
    </QueryClientProvider>
  );
  const utils = await render(app(true));
  return {
    ...utils,
    closePlayer: () => utils.rerender(app(false)),
    reopenPlayer: () => utils.rerender(app(true)),
  };
}

async function renderPlaying() {
  const utils = await renderScreen();
  await act(() => playAlbumFromTrack(albumTracks, albumTracks[0], album));
  return utils;
}

describe("NowPlayingScreen favorite button", () => {
  const nude = { ...track("9", "Nude"), identityKey: "recording:nude" };

  async function renderPlayingNude() {
    const utils = await renderScreen();
    await act(() => playAlbumFromTrack([nude], nude, album));
    return utils;
  }

  it("adds the playing track to favorites", async () => {
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Add Nude to favorites"));

    expect(mockUpdateLibraryFavorites).toHaveBeenCalledWith(
      ["song:recording:nude"],
      true,
    );
  });

  it("removes a track that is already a favorite", async () => {
    mockGetLibraryFavorites.mockResolvedValue(
      favoritesWith({ identityKey: "recording:nude" }),
    );
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Remove Nude from favorites"));

    expect(mockUpdateLibraryFavorites).toHaveBeenCalledWith(
      ["song:recording:nude"],
      false,
    );
  });

  it("fills the heart on the tap, before the server answers", async () => {
    let finishToggle = (_value: unknown) => {};
    mockUpdateLibraryFavorites.mockReturnValueOnce(
      new Promise((resolve) => {
        finishToggle = resolve;
      }),
    );
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Add Nude to favorites"));

    expect(await findByLabelText("Remove Nude from favorites")).toBeTruthy();

    // Left pending, the mutation keeps Jest from exiting.
    await act(async () => {
      finishToggle({ changedIds: [] });
    });
  });

  it("empties the heart again when the server refuses", async () => {
    mockUpdateLibraryFavorites.mockRejectedValueOnce(new Error("refused"));
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Add Nude to favorites"));

    expect(await findByLabelText("Add Nude to favorites")).toBeTruthy();
    expect(mockUpdateLibraryFavorites).toHaveBeenCalledTimes(1);
  });

  it("ignores a tap until it knows whether the track is a favorite", async () => {
    mockGetLibraryFavorites.mockReturnValue(new Promise(() => {}));
    const { findByLabelText } = await renderPlayingNude();

    await fireEvent.press(await findByLabelText("Add Nude to favorites"));

    expect(mockUpdateLibraryFavorites).not.toHaveBeenCalled();
  });

  it("shows no heart for a track the favorites API can't address", async () => {
    const { queryByLabelText } = await renderPlaying();

    expect(queryByLabelText(/favorites$/)).toBeNull();
  });

  describe("on a flow's own track", () => {
    const alison: PlayerTrack = {
      id: "job-1",
      title: "Alison",
      artist: "Slowdive",
      album: "Souvlaki",
      duration: 0,
      url: "https://test.example/api/playlists/stream/job-1",
      artwork: null,
      streamPath: "/playlists/stream/job-1",
      coverPath: null,
      trackMbid: "alison-mb",
      artistMbid: "slowdive-mb",
      albumMbid: null,
      favorite: { kind: "flow-song", key: "flow-1:job-1" },
    };

    async function renderPlayingAlison() {
      const utils = await renderScreen();
      await act(() =>
        playQueueFrom([alison], alison.id, {
          albumTitle: "Weekly Flow",
          artistName: "",
          coverPath: null,
          artworkUrl: null,
          albumMbid: null,
          artistMbid: null,
        }),
      );
      return utils;
    }

    it("adds it to favorites by its place in the flow", async () => {
      const { findByLabelText } = await renderPlayingAlison();

      await fireEvent.press(await findByLabelText("Add Alison to favorites"));

      expect(mockUpdateLibraryFavorites).toHaveBeenCalledWith(
        ["flow-song:flow-1:job-1"],
        true,
      );
    });

    it.each([
      [
        "starred under its own id",
        { ...favoritesWith(), playlistSongIds: ["flow-song:flow-1:job-1"] },
      ],
      // Aurral reports a starred download it has kept as the library track.
      [
        "kept in the library",
        favoritesWith({
          identityKey: "recording:alison",
          mbid: "alison-mb",
          available: true,
        }),
      ],
    ])("fills the heart when it's %s", async (_case, favorites) => {
      mockGetLibraryFavorites.mockResolvedValue(favorites);
      const { findByLabelText } = await renderPlayingAlison();

      expect(
        await findByLabelText("Remove Alison from favorites"),
      ).toBeTruthy();
    });
  });
});

describe("NowPlayingScreen", () => {
  it("shows the track and transport, with up next behind the queue button", async () => {
    const { getByText, getByLabelText, queryByText } = await renderPlaying();

    expect(getByText("Everything In Its Right Place")).toBeTruthy();
    expect(getByText("Radiohead")).toBeTruthy();
    expect(getByLabelText("Play")).toBeTruthy();
    expect(getByLabelText("Previous track")).toBeTruthy();
    expect(getByLabelText("Next track")).toBeTruthy();
    expect(queryByText("The National Anthem")).toBeNull();

    await fireEvent.press(getByLabelText("Queue"));

    // Up next lists what follows the current track, in order.
    expect(getByText("Kid A")).toBeTruthy();
    expect(getByText("The National Anthem")).toBeTruthy();

    await fireEvent.press(getByLabelText("Queue"));

    expect(queryByText("The National Anthem")).toBeNull();
  });

  it("shows the file's format and bitrate, and reads them out in full", async () => {
    const { getByText, getByLabelText } = await renderPlaying();

    expect(getByText("FLAC · 1042 kbps")).toBeTruthy();
    expect(getByLabelText("FLAC, 1042 kilobits per second")).toBeTruthy();
  });

  it("closes from the grabber, for anyone who can't drag it", async () => {
    const { getByLabelText } = await renderPlaying();

    await fireEvent.press(getByLabelText("Close player"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("opens the artist page from the artist line, under the sheet", async () => {
    const { getByLabelText } = await renderPlaying();

    await fireEvent.press(getByLabelText("View artist Radiohead"));

    expectLeftFor({
      pathname: "/(app)/(tabs)/(library)/artist/[mbid]",
      params: { mbid: "artist-mb-1", name: "Radiohead" },
    });
  });

  it("opens the album page from the menu, under the player", async () => {
    const { getByLabelText } = await renderPlaying();

    await fireEvent.press(getByLabelText("Go to Album"));

    expectLeftFor({
      pathname: "/(app)/(tabs)/(library)/album/[ref]",
      params: expect.objectContaining({
        ref: "canonical-album-1",
        title: "Kid A",
      }),
    });
  });

  it("runs a plugin's track action on the playing Library track", async () => {
    const noteTracks = {
      pluginId: "eden",
      pluginName: "Eden",
      id: "track",
      label: "Note these tracks",
      target: "track",
    };
    mockGetPluginActions.mockResolvedValue([noteTracks]);
    mockRunPluginAction.mockResolvedValue("Noted");
    const airbag = {
      ...track("76", "Airbag"),
      streamPath: "/library/stream/12/76",
    };
    const { findByLabelText } = await renderScreen();
    await act(() => playAlbumFromTrack([airbag], airbag, album));

    await fireEvent.press(await findByLabelText("Note these tracks"));

    expect(mockRunPluginAction).toHaveBeenCalledWith(noteTracks, {
      trackIds: ["76"],
    });
  });

  it("adds the playing track to a playlist from the menu", async () => {
    const { getByLabelText } = await renderPlaying();

    await fireEvent.press(getByLabelText("Add to Playlist"));

    expect(mockOpenAddToPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({
        artistName: "Radiohead",
        trackName: "Everything In Its Right Place",
        albumName: "Kid A",
        artistMbid: "artist-mb-1",
      }),
    );
  });

  it("opens a playlist track's own artist, with no album to show", async () => {
    const { getByLabelText, getByText, queryByLabelText } =
      await renderScreen();
    await act(() =>
      playQueueFrom(
        [
          {
            id: "job-1",
            title: "Alison",
            artist: "Slowdive",
            album: "",
            duration: 0,
            url: "https://test.example/api/playlists/stream/job-1",
            artwork: null,
            streamPath: "/playlists/stream/job-1",
            coverPath: null,
            trackMbid: null,
            artistMbid: "slowdive-mb",
            albumMbid: null,
            favorite: null,
          },
        ],
        "job-1",
        {
          albumTitle: "Road Trip",
          artistName: "",
          coverPath: null,
          artworkUrl: null,
          albumMbid: null,
          artistMbid: null,
        },
      ),
    );

    expect(getByText("Slowdive")).toBeTruthy();
    expect(queryByLabelText("Go to Album")).toBeNull();
    await fireEvent.press(getByLabelText("View artist Slowdive"));

    expectLeftFor({
      pathname: "/(app)/(tabs)/(library)/artist/[mbid]",
      params: { mbid: "slowdive-mb", name: "Slowdive" },
    });
  });

  it("seeks when the scrubber is released", async () => {
    const { getByTestId } = await renderPlaying();
    await act(async () => {
      engine.progress(30, 240, false);
    });

    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 120);

    expect(player.seek).toHaveBeenCalledWith(120);
  });

  it("drops the seek target when the track changes", async () => {
    const { getByTestId, getByText } = await renderPlaying();
    await act(async () => {
      engine.progress(30, 240, false);
    });
    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 120);
    expect(getByText("2:00")).toBeTruthy();

    await act(async () => {
      engine.trackChange(
        {
          id: "2",
          title: "Kid A",
          artist: "Radiohead",
          album: "Kid A",
          duration: 0,
          url: "https://test.example/2",
          artwork: null,
        },
        "skip",
      );
    });

    // The new track starts over; 2:00 belonged to the old one.
    expect(getByText("0:00")).toBeTruthy();
  });

  it("lets the ticks take over again when a seek fails", async () => {
    const { getByTestId, getByText } = await renderPlaying();
    await act(async () => {
      engine.progress(30, 240, false);
    });
    player.seek.mockRejectedValueOnce(new Error("engine gone"));

    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 120);
    await act(async () => {});

    expect(getByText("0:30")).toBeTruthy();
  });

  it("keeps a newer seek target when an older seek fails late", async () => {
    const { getByTestId, getByText } = await renderPlaying();
    await act(async () => {
      engine.progress(30, 240, false);
    });

    let rejectFirstSeek!: (error: Error) => void;
    player.seek.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirstSeek = reject;
        }),
    );

    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 120);
    await fireEvent(getByTestId("scrubber-slider"), "slidingComplete", 200);
    await act(async () => {
      rejectFirstSeek(new Error("engine gone"));
    });

    // The failure belonged to the 2:00 seek; the 3:20 target stays.
    expect(getByText("3:20")).toBeTruthy();
  });

  it("shows nothing up next when the playing item is not in the queue", async () => {
    const { getByText, getByLabelText } = await renderPlaying();
    await fireEvent.press(getByLabelText("Queue"));

    // A clip mid-transition: the engine reports an item the facade never
    // queued, so no queue position exists.
    await act(async () => {
      engine.trackChange(
        {
          id: "unqueued-clip",
          title: "Preview",
          artist: "Radiohead",
          album: "Kid A",
          duration: 0,
          url: "https://preview.example/9.mp3",
          artwork: null,
        },
        "user_action",
      );
    });

    expect(getByText("Nothing up next.")).toBeTruthy();
  });

  it("plays a tapped up-next track without rebuilding the queue", async () => {
    const { getByLabelText } = await renderPlaying();
    await fireEvent.press(getByLabelText("Queue"));
    player.playSong.mockClear();
    queue.createPlaylist.mockClear();

    await fireEvent.press(
      getByLabelText("Play The National Anthem by Radiohead"),
    );

    expect(player.playSong).toHaveBeenCalledWith("3", "playlist-1");
    expect(queue.createPlaylist).not.toHaveBeenCalled();
  });

  it("saves the playing track from its menu", async () => {
    setSavedLibraryUser(1);
    try {
      const { getByLabelText } = await renderPlaying();

      await act(async () => {
        fireEvent.press(getByLabelText("Save Offline"));
        for (let i = 0; i < 5; i++) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      });

      // Fetching ahead downloads too, into its own folder.
      const saves = downloads.filter((download) =>
        download.destination.includes("/saved-offline/"),
      );
      expect(saves.map((download) => download.url)).toEqual([
        "https://test.example/api/stream/12/1?token=test-token-123",
      ]);
    } finally {
      await forgetSavedLibrary();
      setSavedLibraryUser(null);
    }
  });

  it("offline, shows an unsaved up-next track as unavailable and stays put on a tap", async () => {
    const { getByLabelText } = await renderPlaying();
    mockOffline = true;
    try {
      await fireEvent.press(getByLabelText("Queue"));
      player.playSong.mockClear();

      const row = getByLabelText("Play The National Anthem by Radiohead");
      expect(row.props.accessibilityState).toEqual({ disabled: true });
      await fireEvent.press(row);

      expect(player.playSong).not.toHaveBeenCalled();
      expect(Burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Not saved on this phone" }),
      );
    } finally {
      mockOffline = false;
    }
  });

  it("cycles repeat from off through the queue to one track", async () => {
    const { getByLabelText } = await renderPlaying();

    await fireEvent.press(getByLabelText("Repeat: off"));
    expect(player.setRepeatMode).toHaveBeenLastCalledWith("Playlist");

    await fireEvent.press(getByLabelText("Repeat: all"));
    expect(player.setRepeatMode).toHaveBeenLastCalledWith("track");

    await fireEvent.press(getByLabelText("Repeat: one"));
    expect(player.setRepeatMode).toHaveBeenLastCalledWith("off");
  });

  it("marks shuffle selected once toggled", async () => {
    const { getByLabelText } = await renderPlaying();

    await fireEvent.press(getByLabelText("Shuffle"));

    expect(getByLabelText("Shuffle").props.accessibilityState?.selected).toBe(
      true,
    );
  });

  it("swaps the play control for pause while playing", async () => {
    const { getByLabelText } = await renderPlaying();

    await act(async () => {
      engine.stateChange("playing", undefined);
    });

    await fireEvent.press(getByLabelText("Pause"));
    expect(player.pause).toHaveBeenCalledTimes(1);
  });
});

describe("NowPlayingScreen autoplay", () => {
  const teardrop: LibraryQueueTrack = {
    id: "91",
    title: "Teardrop",
    artist: "Massive Attack",
    album: "Mezzanine",
    streamPath: "/library/stream/30/91",
    streamFormat: "flac",
    quality: "FLAC",
    durationMs: 330_000,
    artistMbid: "mb-massive",
    albumMbid: "mb-mezzanine",
    trackMbid: null,
    libraryTrackId: 91,
    libraryAlbumId: 30,
    libraryArtistId: 5,
    artworkUrl: "/library/artwork/30",
    artworkSource: "album",
  };

  afterEach(async () => {
    await act(async () => setPlaybackSettings(DEFAULT_PLAYBACK_SETTINGS));
  });

  it("lists Autoplay's tracks under its own heading, and its switch takes them back", async () => {
    mockGetLibraryRadio.mockResolvedValue([teardrop]);
    // Earlier tests leave the shared player shuffled and on repeat, which would
    // keep Autoplay from asking.
    await act(async () => {
      await setShuffle(false);
      await setRepeatMode("off");
    });
    const { getByText, getByLabelText, getByRole, queryByLabelText } =
      await renderPlaying();
    await act(async () => {
      engine.stateChange("playing", undefined);
      engine.trackChange(
        {
          id: "3",
          title: "The National Anthem",
          artist: "Radiohead",
          album: "Kid A",
          duration: 0,
          url: "",
          artwork: null,
        },
        "user_action",
      );
    });
    await fireEvent.press(getByLabelText("Queue"));

    // The album is on its last track, so Up Next is empty and Autoplay's
    // track sits under its own heading.
    expect(getByText("Nothing up next.")).toBeTruthy();
    expect(getByText("Autoplay")).toBeTruthy();
    expect(getByLabelText("Play Teardrop by Massive Attack")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByRole("switch", { name: "Autoplay" }));
    });

    expect(queryByLabelText("Play Teardrop by Massive Attack")).toBeNull();
    expect(getByRole("switch", { name: "Autoplay" })).not.toBeChecked();
  });
});

describe("NowPlayingScreen lyrics", () => {
  const syncedLyrics = {
    synced: true,
    lines: [
      { start: 10_000, value: "Everything" },
      { start: 15_000, value: "" },
      { start: 20_000, value: "In its right place" },
    ],
  };

  function engineTrack(item: Track) {
    return {
      id: item.id,
      title: item.title,
      artist: "Radiohead",
      album: "Kid A",
      duration: 0,
      url: `https://test.example/${item.id}`,
      artwork: null,
    };
  }

  async function playTrack(item: Track) {
    await act(async () => {
      engine.trackChange(engineTrack(item), "skip");
    });
  }

  async function playAt(seconds: number) {
    await act(async () => {
      engine.progress(seconds, 240, false);
    });
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows synced lyrics behind the lyrics button and marks the line being sung", async () => {
    mockGetLyrics.mockResolvedValue(syncedLyrics);
    const { getByLabelText, findByLabelText, getByRole } =
      await renderPlaying();
    await playTrack(albumTracks[0]);
    await playAt(12);

    await fireEvent.press(await findByLabelText("Lyrics"));

    expect(getByLabelText("Lyrics")).toBeSelected();
    expect(getByRole("button", { name: "Everything" })).toBeSelected();
    expect(
      getByRole("button", { name: "In its right place" }),
    ).not.toBeSelected();

    await playAt(21);

    expect(getByRole("button", { name: "Everything" })).not.toBeSelected();
    expect(getByRole("button", { name: "In its right place" })).toBeSelected();
  });

  it("moves the line on between the engine's once-a-second reports, and holds it on pause", async () => {
    mockGetLyrics.mockResolvedValue(syncedLyrics);
    const { findByLabelText, getByRole } = await renderPlaying();
    await playTrack(albumTracks[0]);
    await fireEvent.press(await findByLabelText("Lyrics"));
    // Paused first, whatever an earlier test left, so the clock starts again
    // on the fake timers.
    await act(async () => {
      engine.stateChange("paused", undefined);
    });

    jest.useFakeTimers({ now: Date.now() });
    await act(async () => {
      engine.stateChange("playing", undefined);
    });
    await playAt(9.5);
    expect(getByRole("button", { name: "Everything" })).not.toBeSelected();

    await act(async () => {
      jest.advanceTimersByTime(750);
    });
    expect(getByRole("button", { name: "Everything" })).toBeSelected();

    await act(async () => {
      engine.stateChange("paused", undefined);
    });
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(getByRole("button", { name: "Everything" })).toBeSelected();
    expect(
      getByRole("button", { name: "In its right place" }),
    ).not.toBeSelected();
  });

  it("reopens on the lyrics if they were open when the player closed, and on the art if not", async () => {
    mockGetLyrics.mockResolvedValue(syncedLyrics);
    const {
      closePlayer,
      reopenPlayer,
      findByLabelText,
      findByText,
      getByLabelText,
      queryByText,
    } = await renderPlaying();
    await playTrack(albumTracks[0]);
    await fireEvent.press(await findByLabelText("Lyrics"));

    await closePlayer();
    await reopenPlayer();

    expect(await findByText("Everything")).toBeTruthy();
    expect(getByLabelText("Lyrics")).toBeSelected();

    await fireEvent.press(getByLabelText("Lyrics"));
    await closePlayer();
    await reopenPlayer();

    expect(await findByLabelText("Lyrics")).not.toBeSelected();
    expect(queryByText("Everything")).toBeNull();
  });

  it("plays from a tapped line", async () => {
    mockGetLyrics.mockResolvedValue(syncedLyrics);
    const { findByLabelText, findByRole } = await renderPlaying();
    await playTrack(albumTracks[0]);
    await fireEvent.press(await findByLabelText("Lyrics"));

    await fireEvent.press(
      await findByRole("button", { name: "In its right place" }),
    );

    expect(player.seek).toHaveBeenCalledWith(20);
  });

  it("shows plain lyrics as text", async () => {
    mockGetLyrics.mockResolvedValue({
      synced: false,
      lines: [{ value: "Kid A" }, { value: "" }, { value: "Kid A again" }],
    });
    const { findByLabelText, getByText } = await renderPlaying();
    await playTrack(albumTracks[0]);

    await fireEvent.press(await findByLabelText("Lyrics"));

    expect(getByText("Kid A\n\nKid A again")).toBeTruthy();
  });

  it("dims the lyrics button for a track without lyrics, and opens nothing", async () => {
    const { findByLabelText, getByLabelText, queryByLabelText } =
      await renderPlaying();
    await playTrack(albumTracks[0]);

    expect(await findByLabelText("Lyrics")).toBeDisabled();
    await fireEvent.press(getByLabelText("Lyrics"));

    expect(getByLabelText("Lyrics")).not.toBeSelected();
    expect(queryByLabelText("Loading lyrics")).toBeNull();
  });

  it("gives way to the art for a track without lyrics, and comes back for the next that has them", async () => {
    mockGetLyrics.mockImplementation(async ({ title }) =>
      title === "Kid A" ? null : syncedLyrics,
    );
    const { findByLabelText, findByText, queryByLabelText, queryByText } =
      await renderPlaying();
    await playTrack(albumTracks[0]);
    await fireEvent.press(await findByLabelText("Lyrics"));
    expect(await findByText("Everything")).toBeTruthy();

    await playTrack(albumTracks[1]);

    expect(await findByLabelText("Lyrics")).toBeDisabled();
    expect(queryByText("Everything")).toBeNull();
    expect(queryByLabelText("Loading lyrics")).toBeNull();

    await playTrack(albumTracks[2]);

    expect(await findByText("Everything")).toBeTruthy();
  });
});

describe("NowPlayingScreen devices", () => {
  const web = () => ({
    name: "Aurral web",
    track: { ...albumTracks[1], title: "Roads" },
    positionSeconds: 134,
    savedAt: Date.now() - 60_000,
  });

  it("lists another device's queue and plays it here", async () => {
    mockOtherDevice = web();
    const { getByText, getByLabelText } = await renderPlaying();

    expect(
      getByLabelText("Devices. Aurral web has a queue to pick up."),
    ).toBeTruthy();
    expect(getByText("Roads · 2:14 · 1 min ago")).toBeTruthy();

    await fireEvent.press(getByLabelText("Aurral web"));
    expect(mockPickUpQueue).toHaveBeenCalledTimes(1);
  });

  it("says when its queue won't play here", async () => {
    mockOtherDevice = web();
    mockPickUpQueue.mockRejectedValueOnce(new Error("engine"));
    const { getByLabelText } = await renderPlaying();

    await act(async () => {
      await fireEvent.press(getByLabelText("Aurral web"));
    });

    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't play from Aurral web" }),
    );
  });

  it("labels the button plainly when there's nothing to pick up", async () => {
    const { getByLabelText } = await renderPlaying();

    expect(getByLabelText("Devices")).toBeTruthy();
  });
});

describe("NowPlayingScreen Library details", () => {
  // As the server's play queue and radio send it: no identity key, no bitrate.
  const roads: LibraryQueueTrack = {
    id: "82",
    title: "Roads",
    artist: "Portishead",
    album: "Dummy",
    streamPath: "/library/stream/30/82",
    streamFormat: "flac",
    quality: "FLAC",
    durationMs: 302_000,
    artistMbid: "mb-portishead",
    albumMbid: "mb-dummy",
    trackMbid: null,
    libraryTrackId: 82,
    libraryAlbumId: 30,
    libraryArtistId: 5,
    artworkUrl: "/library/artwork/30",
    artworkSource: "album",
  };

  it("reads a queued Library track's favorite and bitrate from its album", async () => {
    mockGetCanonicalAlbumTracks.mockResolvedValue([
      {
        ...track("82", "Roads"),
        identityKey: "recording:roads",
        bitrateKbps: 1411,
      },
    ]);
    const { findByLabelText, findByText } = await renderScreen();
    const item = queueTrackToPlayerTrack(roads, null)!;
    await act(() => playQueueFrom([item], item.id, album));

    expect(await findByLabelText("Add Roads to favorites")).toBeTruthy();
    expect(await findByText("FLAC · 1411 kbps")).toBeTruthy();
    expect(mockGetCanonicalAlbumTracks).toHaveBeenCalledWith("30");
  });
});
