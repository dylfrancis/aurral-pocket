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
  convertFlowToStaticPlaylist: jest.fn(() =>
    Promise.resolve({ id: "pl-9", name: "Saved" }),
  ),
  deleteFlow: jest.fn(() => Promise.resolve()),
  getFlowStatus: jest.fn(),
  getPlaylistJobs: jest.fn(),
  startFlow: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/player/player", () => ({
  pause: jest.fn(),
  pauseClip: jest.fn(),
  playItem: jest.fn(),
  playQueueFrom: jest.fn(() => Promise.resolve()),
  resume: jest.fn(),
  setShuffle: jest.fn(() => Promise.resolve()),
  useCurrentTrack: () => null,
  usePlaybackState: () => "stopped",
  usePlayerStatus: () => ({}),
}));

jest.mock("@/components/library/TrackRow", () => ({
  PlayingBars: () => null,
}));

jest.mock("@/components/flow/AddToPlaylistSheet", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    useAddToPlaylist: () => {
      const [track, setTrack] = React.useState(null);
      return { track, open: setTrack, close: () => setTrack(null) };
    },
    AddToPlaylistSheet: ({ track }: { track: { trackName: string } | null }) =>
      track ? <Text>Adding {track.trackName}</Text> : null,
  };
});

jest.mock("expo-image", () => ({ Image: () => null }));

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  // The native menu renders nothing under Jest, so each action renders as a
  // pressable labelled by its title.
  const MenuAction = ({ children, disabled, onPress }: any) =>
    React.createElement(
      Pressable,
      { disabled, onPress },
      React.createElement(Text, null, children),
    );
  const Passthrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  const Toolbar = Object.assign(Passthrough, { Menu: Passthrough, MenuAction });
  return {
    useFocusEffect: jest.fn(),
    useLocalSearchParams: () => ({ id: "flow-1" }),
    useRouter: () => ({ back: mockBack, push: mockPush }),
    Stack: { Screen: () => null, SearchBar: () => null, Toolbar },
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
import { FlowDetailScreen } from "@/components/flow/FlowDetailScreen";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import {
  convertFlowToStaticPlaylist,
  deleteFlow,
  getFlowStatus,
  getPlaylistJobs,
  startFlow,
} from "@/lib/api/flow";
import { playQueueFrom } from "@/lib/player/player";
import type { FlowJob } from "@/lib/types/flow";

const mockPlayQueueFrom = playQueueFrom as jest.Mock;

function job(id: string, overrides: Partial<FlowJob> = {}): FlowJob {
  return {
    id,
    playlistType: "flow-1",
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

const FLOW = {
  id: "flow-1",
  name: "Chill",
  enabled: true,
  size: 3,
  mix: { discover: 100, mix: 0, trending: 0, focus: 0, newReleases: 0 },
  deepDive: false,
  recentListening: false,
  tags: [],
  excludeTags: [],
  relatedArtists: [],
  scheduleDays: [1],
  scheduleTime: "06:00",
  nextRunAt: null,
};

function serve({
  flow = FLOW as Record<string, unknown>,
  jobs = [job("a"), job("b", { status: "downloading" })],
  stats = { done: 1, total: 3 } as object | undefined,
  sharedPlaylists = [] as { name: string }[],
  hint = { phase: "idle", message: "Idle" },
} = {}) {
  (getFlowStatus as jest.Mock).mockResolvedValue({
    flows: [flow],
    sharedPlaylists,
    flowStats: stats ? { "flow-1": stats } : {},
    hint,
  });
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
        <FlowDetailScreen />
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
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  serve();
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("FlowDetailScreen", () => {
  it("refuses a deep link without accessFlow, requesting nothing", async () => {
    mockUser = { role: "user", permissions: { accessFlow: false } };

    await renderPage();

    expect(screen.getByText("You don't have access to Flows")).toBeTruthy();
    expect(getFlowStatus).not.toHaveBeenCalled();
    expect(getPlaylistJobs).not.toHaveBeenCalled();
  });

  it("says so when the flow no longer exists", async () => {
    (getFlowStatus as jest.Mock).mockResolvedValue({
      flows: [],
      sharedPlaylists: [],
    });

    await renderPage();

    expect(await screen.findByText("This flow no longer exists")).toBeTruthy();
  });

  it("shows the flow's schedule and how much of it is ready", async () => {
    await open();

    expect(screen.getByText("Mon · 06:00")).toBeTruthy();
    expect(screen.getByText("3 tracks · 1 ready")).toBeTruthy();
  });

  describe("the worker's status", () => {
    it.each(["preparing", "downloading", "queued"])(
      "shows while it's %s",
      async (phase) => {
        serve({ hint: { phase, message: "Working on it" } });

        await open();

        expect(screen.getByText("Working on it")).toBeTruthy();
      },
    );

    it.each([
      ["idle", "Idle"],
      ["completed", "Next update in 3 days"],
    ])("stays out of the way when %s", async (phase, message) => {
      serve({ hint: { phase, message } });

      await open();

      expect(screen.queryByText(message)).toBeNull();
    });
  });

  it("hides failed tracks, which the next run replaces", async () => {
    serve({ jobs: [job("a"), job("b", { status: "failed" })] });

    await open();

    expect(screen.queryByText("Track b")).toBeNull();
  });

  it("says how to get tracks when a turned-off flow has none", async () => {
    serve({ flow: { ...FLOW, enabled: false }, jobs: [] });

    await renderPage();

    expect(
      await screen.findByText(
        "Turn the flow on in the Flows list, or choose Start Now from the menu, to get tracks.",
      ),
    ).toBeTruthy();
  });

  describe("playing", () => {
    it("queues the ready tracks under the flow's name", async () => {
      await open();

      await fireEvent.press(screen.getByText("Play"));

      const [items, startId, context] = mockPlayQueueFrom.mock.calls[0];
      expect(items.map((item: { id: string }) => item.id)).toEqual(["a"]);
      expect(startId).toBe("a");
      expect(context).toMatchObject({ albumTitle: "Chill" });
    });

    it("favorites a track as the flow's own song", async () => {
      await open();

      await fireEvent.press(screen.getByText("Play"));

      expect(mockPlayQueueFrom.mock.calls[0][0][0].favorite).toEqual({
        kind: "flow-song",
        key: "flow-1:a",
      });
    });

    it("keeps a flow's plays out of history when it opted out", async () => {
      serve({ flow: { ...FLOW, recordHistory: false } });
      await open();

      await fireEvent.press(screen.getByText("Track a"));

      expect(mockPlayQueueFrom.mock.calls[0][0][0].recordHistory).toBe(false);
    });
  });

  it("saves a ready track to a playlist from its menu", async () => {
    await open();

    await fireEvent.press(screen.getByLabelText("More actions for Track a"));

    expect(screen.getByText("Adding Track a")).toBeTruthy();
  });

  it("offers no menu on a track that isn't ready", async () => {
    await open();

    expect(screen.queryByLabelText("More actions for Track b")).toBeNull();
  });

  it("opens the editor for this flow", async () => {
    await open();

    await fireEvent.press(screen.getByLabelText("Edit Chill"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(flow)/flow-edit",
      params: { id: "flow-1" },
    });
  });

  describe("the toolbar menu", () => {
    it("starts the flow", async () => {
      await open();

      await fireEvent.press(screen.getByText("Start Now"));

      await waitFor(() =>
        expect(startFlow).toHaveBeenCalledWith("flow-1", undefined),
      );
    });

    it.each([
      ["no playlist has the name", [], "Chill Static"],
      ["the name is taken, in any case", ["chill static"], "Chill Static 2"],
      [
        "the numbered name is taken too",
        ["Chill Static", "Chill Static 2"],
        "Chill Static 3",
      ],
    ])("converts under a free name when %s", async (_case, taken, expected) => {
      serve({ sharedPlaylists: taken.map((name) => ({ name })) });
      await open();

      await fireEvent.press(screen.getByText("Convert to Static"));
      await confirmAlert("Save");

      await waitFor(() =>
        expect(convertFlowToStaticPlaylist).toHaveBeenCalledWith(
          "flow-1",
          expected,
        ),
      );
    });

    it("can't convert a flow with nothing downloaded", async () => {
      serve({ jobs: [job("a", { status: "pending" })], stats: { done: 0 } });
      await open();

      await fireEvent.press(screen.getByText("Convert to Static"));

      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it("leaves the page, then deletes, once confirmed", async () => {
      await open();

      await fireEvent.press(screen.getByText("Delete Flow"));
      expect(deleteFlow).not.toHaveBeenCalled();
      expect(mockBack).not.toHaveBeenCalled();
      await confirmAlert("Delete");

      expect(mockBack).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(deleteFlow).toHaveBeenCalled());
      expect((deleteFlow as jest.Mock).mock.calls[0][0]).toBe("flow-1");
    });

    it("says why when a delete fails", async () => {
      (deleteFlow as jest.Mock).mockRejectedValueOnce(
        new Error("Flow not found"),
      );
      await open();

      await fireEvent.press(screen.getByText("Delete Flow"));
      await confirmAlert("Delete");

      await waitFor(() =>
        expect(Burnt.toast).toHaveBeenCalledWith({
          title: "Couldn't delete flow",
          message: "Flow not found",
          preset: "error",
        }),
      );
    });
  });
});
