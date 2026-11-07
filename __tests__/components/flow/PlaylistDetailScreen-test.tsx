jest.mock("burnt", () => ({ toast: jest.fn() }));

let mockUser: { role: string; permissions: { accessFlow: boolean } };
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    serverUrl: "http://server",
    token: "token",
    user: mockUser,
  }),
}));

jest.mock("@/lib/api/flow", () => ({
  ...jest.requireActual("@/lib/api/flow"),
  deleteSharedPlaylist: jest.fn(() => Promise.resolve()),
  deleteSharedPlaylistTrack: jest.fn(() => Promise.resolve()),
  getFlowStatus: jest.fn(),
  getPlaylistJobs: jest.fn(),
  setRetryCyclePaused: jest.fn(() => Promise.resolve()),
}));

let mockCurrentTrackId: string | null = null;
jest.mock("@/lib/player/player", () => ({
  pause: jest.fn(),
  pauseClip: jest.fn(),
  playItem: jest.fn(),
  playQueueFrom: jest.fn(() => Promise.resolve()),
  resume: jest.fn(),
  setShuffle: jest.fn(() => Promise.resolve()),
  useCurrentTrack: () =>
    mockCurrentTrackId ? { id: mockCurrentTrackId } : null,
  usePlaybackState: () => "playing",
  usePlayerStatus: () => ({}),
}));

jest.mock("@/components/library/TrackRow", () => ({
  PlayingBars: () => {
    const { Text } = require("react-native");
    return <Text>Now playing</Text>;
  },
}));

jest.mock("expo-image", () => ({ Image: () => null }));

let mockSearchBar: {
  onChangeText: (event: { nativeEvent: { text: string } }) => void;
};
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  // The native menu renders nothing under Jest, so each action renders as a
  // pressable labelled by its title.
  const MenuAction = ({ children, onPress }: any) =>
    React.createElement(
      Pressable,
      { onPress },
      React.createElement(Text, null, children),
    );
  const Passthrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  const Toolbar = Object.assign(Passthrough, { Menu: Passthrough, MenuAction });
  return {
    useFocusEffect: jest.fn(),
    useLocalSearchParams: () => ({ id: "pl-1" }),
    useRouter: () => ({ back: mockBack, push: mockPush }),
    Stack: {
      Screen: () => null,
      Toolbar,
      SearchBar: (props: any) => {
        mockSearchBar = props;
        return null;
      },
    },
  };
});

jest.mock("expo-router/react-navigation", () => ({
  useHeaderHeight: () => 0,
  useIsFocused: () => true,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("react-native-reanimated", () => {
  const { FlatList } = require("react-native");
  return {
    __esModule: true,
    default: { FlatList },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedScrollHandler: () => () => {},
  };
});

jest.mock("@/components/artist/ArtistDetailLayout", () => ({
  ScrollHeaderTitle: () => null,
}));

import React from "react";
import { Alert } from "react-native";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { PlaylistDetailScreen } from "@/components/flow/PlaylistDetailScreen";
import {
  deleteSharedPlaylist,
  deleteSharedPlaylistTrack,
  getFlowStatus,
  getPlaylistJobs,
  setRetryCyclePaused,
} from "@/lib/api/flow";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import { playQueueFrom, setShuffle } from "@/lib/player/player";
import type { FlowJob, FlowStatusSnapshot } from "@/lib/types/flow";

const mockPlayQueueFrom = playQueueFrom as jest.Mock;

function job(id: string, overrides: Partial<FlowJob> = {}): FlowJob {
  return {
    id,
    playlistType: "pl-1",
    artistName: `Artist ${id}`,
    trackName: `Track ${id}`,
    albumName: `Album ${id}`,
    artistMbid: null,
    albumMbid: null,
    trackMbid: null,
    status: "done",
    ...overrides,
  };
}

const PLAYLIST = {
  id: "pl-1",
  name: "Road Trip",
  sourceName: "Chill",
  sourceFlowId: "flow-1",
  trackCount: 3,
  recordHistory: true,
};

function serve({
  jobs = [job("a"), job("b", { status: "downloading" }), job("c")],
  paused = false,
  stats = { done: 2, total: 3 },
}: { jobs?: FlowJob[]; paused?: boolean; stats?: object } = {}) {
  (getFlowStatus as jest.Mock).mockResolvedValue({
    flows: [],
    sharedPlaylists: [PLAYLIST],
    sharedPlaylistStats: { "pl-1": stats },
    retryCyclePausedByPlaylist: { "pl-1": paused },
  } as unknown as FlowStatusSnapshot);
  (getPlaylistJobs as jest.Mock).mockResolvedValue(jobs);
}

const clients: QueryClient[] = [];

async function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <React.Suspense fallback={null}>
        <PlaylistDetailScreen />
      </React.Suspense>
    </QueryClientProvider>,
  );
}

async function open() {
  await renderPage();
  await screen.findByText("Track a");
}

function confirmAlert(buttonText: string) {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] ?? [];
  const button = buttons.find(
    (entry: { text: string }) => entry.text === buttonText,
  );
  return act(async () => button.onPress());
}

beforeEach(() => {
  jest.clearAllMocks();
  setBaseUrl("http://server");
  setAuthToken("token");
  mockUser = { role: "user", permissions: { accessFlow: true } };
  mockCurrentTrackId = null;
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  serve();
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("PlaylistDetailScreen", () => {
  it("refuses a deep link without accessFlow, requesting nothing", async () => {
    mockUser = { role: "user", permissions: { accessFlow: false } };

    await renderPage();

    expect(screen.getByText("You don't have access to Playlists")).toBeTruthy();
    expect(getFlowStatus).not.toHaveBeenCalled();
    expect(getPlaylistJobs).not.toHaveBeenCalled();
  });

  it("says so when the playlist no longer exists", async () => {
    (getFlowStatus as jest.Mock).mockResolvedValue({
      flows: [],
      sharedPlaylists: [],
    });

    await renderPage();

    expect(
      await screen.findByText("This playlist no longer exists"),
    ).toBeTruthy();
  });

  it("shows the playlist's source and how much of it is ready", async () => {
    await open();

    expect(screen.getByText("from Chill")).toBeTruthy();
    expect(screen.getByText("3 tracks · 2 ready")).toBeTruthy();
    expect(screen.getByText("Downloading")).toBeTruthy();
  });

  it("lists a failed track with its badge, and doesn't queue it", async () => {
    serve({ jobs: [job("a"), job("b", { status: "failed" })] });
    await open();

    expect(screen.getByText("Failed")).toBeTruthy();
    await fireEvent.press(screen.getByText("Play"));

    expect(
      mockPlayQueueFrom.mock.calls[0][0].map((item: { id: string }) => item.id),
    ).toEqual(["a"]);
  });

  it("claims no ready count when the server sent no stats", async () => {
    (getFlowStatus as jest.Mock).mockResolvedValue({
      flows: [],
      sharedPlaylists: [PLAYLIST],
    });

    await open();

    expect(screen.getByText("3 tracks")).toBeTruthy();
  });

  it("drops the ready count once every track is ready", async () => {
    serve({ stats: { done: 3, total: 3 } });

    await open();

    expect(screen.getByText("3 tracks")).toBeTruthy();
  });

  describe("playing", () => {
    const queuedIds = () =>
      mockPlayQueueFrom.mock.calls[0][0].map((item: { id: string }) => item.id);

    it("plays the ready tracks in order from the first", async () => {
      await open();

      await fireEvent.press(screen.getByText("Play"));

      expect(queuedIds()).toEqual(["a", "c"]);
      expect(mockPlayQueueFrom.mock.calls[0][1]).toBe("a");
      // The context is what keeps the queue playing once the page closes.
      expect(mockPlayQueueFrom.mock.calls[0][2]).toMatchObject({
        albumTitle: "Road Trip",
      });
    });

    it("plays from a tapped track, with the rest queued around it", async () => {
      await open();

      await fireEvent.press(screen.getByText("Track c"));

      expect(queuedIds()).toEqual(["a", "c"]);
      expect(mockPlayQueueFrom.mock.calls[0][1]).toBe("c");
    });

    it("does nothing for a track still downloading", async () => {
      await open();

      await fireEvent.press(screen.getByText("Track b"));

      expect(mockPlayQueueFrom).not.toHaveBeenCalled();
    });

    it("turns shuffle on before the queue is built", async () => {
      await open();

      await fireEvent.press(screen.getByLabelText("Shuffle Road Trip"));

      await waitFor(() => expect(mockPlayQueueFrom).toHaveBeenCalled());
      expect(setShuffle).toHaveBeenCalledWith(true);
      expect(
        (setShuffle as jest.Mock).mock.invocationCallOrder[0],
      ).toBeLessThan(mockPlayQueueFrom.mock.invocationCallOrder[0]);
    });

    it("can't play a playlist with nothing downloaded", async () => {
      serve({ jobs: [job("a", { status: "pending" })], stats: { done: 0 } });
      await open();

      await fireEvent.press(screen.getByText("Play"));

      expect(mockPlayQueueFrom).not.toHaveBeenCalled();
    });

    it("reads the session token when tapped, not when the page opened", async () => {
      await open();
      setAuthToken("rotated-token");

      await fireEvent.press(screen.getByText("Play"));

      expect(mockPlayQueueFrom.mock.calls[0][0][0].url).toContain(
        "token=rotated-token",
      );
    });

    it("reports a failed shuffle instead of doing nothing", async () => {
      (setShuffle as jest.Mock).mockRejectedValueOnce(new Error("no engine"));
      await open();

      await fireEvent.press(screen.getByLabelText("Shuffle Road Trip"));

      await waitFor(() =>
        expect(Burnt.toast).toHaveBeenCalledWith({
          title: "Playback failed",
          message: "no engine",
          preset: "error",
        }),
      );
      expect(mockPlayQueueFrom).not.toHaveBeenCalled();
    });

    it("says so when playback fails", async () => {
      mockPlayQueueFrom.mockRejectedValueOnce(new Error("engine said no"));
      await open();

      await fireEvent.press(screen.getByText("Play"));

      await waitFor(() =>
        expect(Burnt.toast).toHaveBeenCalledWith({
          title: "Playback failed",
          message: "engine said no",
          preset: "error",
        }),
      );
    });

    it("marks the track the player is on", async () => {
      mockCurrentTrackId = "c";

      await open();

      expect(screen.getByText("Now playing")).toBeTruthy();
    });
  });

  describe("searching", () => {
    const search = (text: string) =>
      act(async () => mockSearchBar.onChangeText({ nativeEvent: { text } }));

    it.each([
      ["track", "track c"],
      ["artist", "ARTIST C"],
      ["album", " album c "],
    ])("finds a track by its %s", async (_field, query) => {
      await open();

      await search(query);

      expect(screen.getByText("Track c")).toBeTruthy();
      expect(screen.queryByText("Track a")).toBeNull();
    });

    it("keeps a result's number from the whole playlist", async () => {
      await open();

      await search("track c");

      expect(screen.getByText("3")).toBeTruthy();
      expect(screen.queryByText("1")).toBeNull();
    });

    it("queues the whole playlist when a result is played", async () => {
      await open();
      await search("track c");

      await fireEvent.press(screen.getByText("Track c"));

      expect(
        mockPlayQueueFrom.mock.calls[0][0].map(
          (item: { id: string }) => item.id,
        ),
      ).toEqual(["a", "c"]);
      expect(mockPlayQueueFrom.mock.calls[0][1]).toBe("c");
    });

    it("hides the cover and play row while searching, so results show", async () => {
      await open();

      await search("track");

      expect(screen.queryByText("Play")).toBeNull();
      await search("");
      expect(screen.getByText("Play")).toBeTruthy();
    });

    it("says so when nothing matches", async () => {
      await open();

      await search("polka");

      expect(screen.getByText("No results matching “polka”")).toBeTruthy();
    });

    it("keeps its handler stable, so typing can't rebuild the header", async () => {
      await open();
      const before = mockSearchBar.onChangeText;

      await search("track");

      expect(mockSearchBar.onChangeText).toBe(before);
    });
  });

  it("opens the editor for this playlist", async () => {
    await open();

    await fireEvent.press(screen.getByLabelText("Edit Road Trip"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(library)/playlist-edit",
      params: { id: "pl-1" },
    });
  });

  describe("removing a track", () => {
    it("asks first, then removes the track", async () => {
      await open();

      await fireEvent.press(screen.getByLabelText("More actions for Track a"));
      expect(deleteSharedPlaylistTrack).not.toHaveBeenCalled();
      await confirmAlert("Remove");

      expect(deleteSharedPlaylistTrack).toHaveBeenCalledWith("pl-1", "a");
    });

    it("removes a failed track too, which can't be played", async () => {
      serve({ jobs: [job("a"), job("b", { status: "failed" })] });
      await open();

      await fireEvent.press(screen.getByLabelText("More actions for Track b"));
      await confirmAlert("Remove");

      expect(deleteSharedPlaylistTrack).toHaveBeenCalledWith("pl-1", "b");
    });
  });

  describe("the toolbar menu", () => {
    it.each([
      [false, "Pause Retry", true],
      [true, "Resume Retry", false],
    ])("when paused is %s, offers %s", async (paused, label, nextPaused) => {
      serve({ paused });
      await open();

      await fireEvent.press(screen.getByText(label));

      await waitFor(() =>
        expect(setRetryCyclePaused).toHaveBeenCalledWith("pl-1", nextPaused),
      );
    });

    it("shows that retries are paused", async () => {
      serve({ paused: true });

      await open();

      expect(screen.getByText("Retry paused")).toBeTruthy();
    });

    it("leaves the page, then deletes, once confirmed", async () => {
      await open();

      await fireEvent.press(screen.getByText("Delete Playlist"));
      expect(deleteSharedPlaylist).not.toHaveBeenCalled();
      expect(mockBack).not.toHaveBeenCalled();
      await confirmAlert("Delete");

      expect(mockBack).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(deleteSharedPlaylist).toHaveBeenCalled());
      expect((deleteSharedPlaylist as jest.Mock).mock.calls[0][0]).toBe("pl-1");
    });

    it("says why when a delete fails", async () => {
      (deleteSharedPlaylist as jest.Mock).mockRejectedValueOnce(
        new Error("Playlist not found"),
      );
      await open();

      await fireEvent.press(screen.getByText("Delete Playlist"));
      await confirmAlert("Delete");

      await waitFor(() =>
        expect(Burnt.toast).toHaveBeenCalledWith({
          title: "Couldn't delete playlist",
          message: "Playlist not found",
          preset: "error",
        }),
      );
    });
  });
});
