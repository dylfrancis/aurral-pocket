jest.mock("burnt", () => ({ toast: jest.fn() }));

let mockUser: { role: string; permissions: { accessFlow: boolean } };
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    serverUrl: "http://server",
    token: "token",
    user: mockUser,
  }),
}));

jest.mock("@/lib/api/search", () => ({
  addEditorialPlaylistToLibrary: jest.fn(),
  getEditorialLinks: jest.fn(),
  getEditorialPlaylist: jest.fn(),
}));

jest.mock("@/lib/api/flow", () => ({
  ...jest.requireActual("@/lib/api/flow"),
  getFlowStatus: jest.fn(() =>
    Promise.resolve({ flows: [], sharedPlaylists: [] }),
  ),
}));

let mockStatus: Record<string, unknown> = {};
jest.mock("@/lib/player/player", () => ({
  pause: jest.fn(),
  pauseClip: jest.fn(),
  playItem: jest.fn(() => Promise.resolve()),
  resume: jest.fn(),
  useCurrentTrack: () => null,
  usePlaybackState: () => "stopped",
  usePlayerStatus: () => mockStatus,
}));

jest.mock("@/components/library/PlayingBars", () => ({
  PlayingBars: () => null,
}));

// The test's Reanimated stub has none of what the skeleton animates with.
jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));

let mockParams: Record<string, string>;
let mockFocused = true;
const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ isFocused: () => mockFocused }),
  useSegments: () => ["(app)", "(tabs)", "(discover)"],
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
  Stack: { Screen: () => null, SearchBar: () => null },
}));

jest.mock("expo-router/react-navigation", () => ({
  useHeaderHeight: () => 0,
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
import { EditorialPlaylistScreen } from "@/components/discover/EditorialPlaylistScreen";
import { ApiError } from "@/lib/api/client";
import {
  addEditorialPlaylistToLibrary,
  getEditorialLinks,
  getEditorialPlaylist,
} from "@/lib/api/search";
import { pauseClip, playItem } from "@/lib/player/player";
import { flowKeys } from "@/lib/query-keys";
import type { EditorialPlaylist, EditorialTrack } from "@/lib/types/search";

const mockGetPlaylist = getEditorialPlaylist as jest.Mock;
const mockAdd = addEditorialPlaylistToLibrary as jest.Mock;
const mockGetLinks = getEditorialLinks as jest.Mock;

function track(overrides: Partial<EditorialTrack> = {}): EditorialTrack {
  return {
    artistName: "Nirvana",
    trackName: "Lithium",
    albumName: "Nevermind",
    preview_url: "/api/deezer/preview/1.mp3",
    artworkUrl: "https://cdn.example/nevermind.jpg",
    deezerAlbumId: "119853",
    ...overrides,
  };
}

function playlist(overrides: Partial<EditorialPlaylist> = {}) {
  return {
    id: "878",
    name: "90s Hits",
    description: "The hits of the 90s.",
    curator: "Deezer Pop Editor",
    artworkUrl: "https://cdn.example/90s.jpg",
    tracks: [track()],
    libraryPlaylistId: null,
    ...overrides,
  };
}

const clients: QueryClient[] = [];

async function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  clients.push(client);
  const view = await render(
    <QueryClientProvider client={client}>
      <EditorialPlaylistScreen />
    </QueryClientProvider>,
  );
  return { client, view };
}

async function openPage(data: EditorialPlaylist = playlist()) {
  mockGetPlaylist.mockResolvedValue(data);
  const rendered = await renderPage();
  await screen.findByText(data.name);
  await waitFor(() => expect(mockGetPlaylist).toHaveBeenCalled());
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPlaylist.mockReset();
  mockAdd.mockReset();
  mockGetLinks.mockReset();
  mockUser = { role: "user", permissions: { accessFlow: true } };
  mockParams = { id: "878" };
  mockFocused = true;
  mockStatus = {};
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("the page itself", () => {
  it("paints the card's name while the playlist loads", async () => {
    mockParams = { id: "878", name: "From the card", trackCount: "12" };
    mockGetPlaylist.mockReturnValue(new Promise(() => {}));

    await renderPage();

    expect(screen.getByText("From the card")).toBeTruthy();
    expect(screen.getByText("12 tracks")).toBeTruthy();
  });

  it("shows the description, curator and real track count once loaded", async () => {
    await openPage(
      playlist({ tracks: [track(), track({ trackName: "Polly" })] }),
    );

    expect(await screen.findByText("The hits of the 90s.")).toBeTruthy();
    expect(screen.getByText("Deezer Pop Editor · 2 tracks")).toBeTruthy();
  });

  it("explains a playlist Deezer no longer has, with nothing to retry", async () => {
    mockGetPlaylist.mockRejectedValue(new ApiError(404, "gone"));

    await renderPage();

    expect(
      await screen.findByText("Deezer no longer has this playlist"),
    ).toBeTruthy();
    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("retries any other failure", async () => {
    mockGetPlaylist
      .mockRejectedValueOnce(new ApiError(502, "Deezer is down"))
      .mockResolvedValue(playlist());

    await renderPage();
    await fireEvent.press(await screen.findByText("Try Again"));

    expect(await screen.findByText("Lithium")).toBeTruthy();
  });
});

describe("previews", () => {
  it("offers a play button only on tracks with a clip", async () => {
    await openPage(
      playlist({
        tracks: [
          track({ trackName: "Lithium" }),
          track({ trackName: "Polly", preview_url: null }),
        ],
      }),
    );

    await screen.findByText("Polly");
    expect(screen.getByLabelText("Preview Lithium")).toBeTruthy();
    expect(screen.queryByLabelText("Preview Polly")).toBeNull();
  });

  it("plays the tapped track's clip with its details", async () => {
    await openPage();

    await fireEvent.press(await screen.findByLabelText("Preview Lithium"));

    await waitFor(() =>
      expect(playItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Lithium",
          artist: "Nirvana",
          album: "Nevermind",
          artwork: "https://cdn.example/nevermind.jpg",
          url: expect.stringContaining("/api/deezer/preview/1.mp3"),
        }),
      ),
    );
  });

  it("gives two tracks of the same song separate play states", async () => {
    mockStatus = { currentId: "deezer-878-1", isPlaying: true, progress: 0.5 };

    await openPage(
      playlist({
        tracks: [
          track({ trackName: "Same Song" }),
          track({ trackName: "Same Song" }),
        ],
      }),
    );

    await screen.findByLabelText("Pause Same Song");
    expect(screen.getAllByLabelText("Preview Same Song")).toHaveLength(1);
  });

  it("stops the clip when the page closes", async () => {
    const { view } = await openPage();

    await view.unmount();

    expect(pauseClip).toHaveBeenCalled();
  });
});

describe("Add to Library", () => {
  it("saves the playlist and switches the page over without rereading it", async () => {
    mockAdd.mockResolvedValue({
      playlistId: "lib-1",
      name: "90s Hits",
      alreadyAdded: false,
      tracksQueued: 100,
    });
    const { client } = await openPage();
    client.setQueryDefaults(flowKeys.status(), { gcTime: Infinity });
    client.setQueryData(flowKeys.status(), { flows: [], sharedPlaylists: [] });

    await fireEvent.press(await screen.findByText("Add to Library"));

    expect(await screen.findByText("Open in Library")).toBeTruthy();
    expect(screen.queryByText("Add to Library")).toBeNull();
    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Added to your playlists",
        preset: "done",
      }),
    );
    // A reread straight after the save can still say it isn't saved.
    expect(mockGetPlaylist).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(flowKeys.status())?.isInvalidated).toBe(true);
  });

  it("reports a playlist the server already has", async () => {
    mockAdd.mockResolvedValue({
      playlistId: "lib-1",
      name: "90s Hits",
      alreadyAdded: true,
    });
    await openPage();

    await fireEvent.press(await screen.findByText("Add to Library"));

    await screen.findByText("Open in Library");
    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Already in your playlists" }),
    );
  });

  it("keeps the button when the save fails", async () => {
    mockAdd.mockRejectedValue(new ApiError(502, "Deezer is down"));
    await openPage();

    await fireEvent.press(await screen.findByText("Add to Library"));

    await waitFor(() =>
      expect(Burnt.toast).toHaveBeenCalledWith({
        title: "Couldn't add playlist",
        message: "Deezer is down",
        preset: "error",
      }),
    );
    expect(screen.getByText("Add to Library")).toBeTruthy();
  });

  it("can't add before the page knows whether it's already saved", async () => {
    mockParams = { id: "878", name: "From the card" };
    mockGetPlaylist.mockReturnValue(new Promise(() => {}));

    await renderPage();
    await fireEvent.press(screen.getByText("Add to Library"));

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("opens Library > Playlists for a saved playlist", async () => {
    await openPage(playlist({ libraryPlaylistId: "lib-1" }));

    await fireEvent.press(await screen.findByText("Open in Library"));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/(app)/(tabs)/(library)/playlists",
      ),
    );
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it.each([null, "lib-1"])(
    "offers nothing without accessFlow (saved as %s)",
    async (libraryPlaylistId) => {
      mockUser = { role: "user", permissions: { accessFlow: false } };

      await openPage(playlist({ libraryPlaylistId }));

      await screen.findByText("Lithium");
      expect(screen.queryByText("Add to Library")).toBeNull();
      expect(screen.queryByText("Open in Library")).toBeNull();
    },
  );
});

describe("artist and album links", () => {
  const artistMbid = "artist-mbid";
  const albumMbid = "album-mbid";

  it("opens the artist page from the artist's name alone", async () => {
    mockGetLinks.mockResolvedValue({ artistMbid, albumMbid: null });
    await openPage();

    await fireEvent.press(await screen.findByLabelText("Open artist Nirvana"));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/artist/[mbid]",
        params: { mbid: artistMbid, name: "Nirvana" },
      }),
    );
    expect(mockGetLinks).toHaveBeenCalledWith({
      artist: "Nirvana",
      album: null,
      albumId: null,
    });
    expect(pauseClip).toHaveBeenCalled();
  });

  it("opens the release page for an album", async () => {
    mockGetLinks.mockResolvedValue({ artistMbid, albumMbid });
    await openPage();

    await fireEvent.press(await screen.findByLabelText("Open album Nevermind"));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/release/[mbid]",
        params: expect.objectContaining({
          mbid: albumMbid,
          title: "Nevermind",
          artistName: "Nirvana",
          artistMbid,
        }),
      }),
    );
    expect(mockGetLinks).toHaveBeenCalledWith({
      artist: "Nirvana",
      album: "Nevermind",
      albumId: "119853",
    });
  });

  it("opens the artist and says so when the album isn't found", async () => {
    mockGetLinks.mockResolvedValue({ artistMbid, albumMbid: null });
    await openPage();

    await fireEvent.press(await screen.findByLabelText("Open album Nevermind"));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/artist/[mbid]" }),
      ),
    );
    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't find Nevermind. Opened Nirvana instead.",
      }),
    );
  });

  it("stays put and says so when nothing resolves", async () => {
    mockGetLinks.mockResolvedValue({ artistMbid: null, albumMbid: null });
    await openPage();

    await fireEvent.press(await screen.findByLabelText("Open artist Nirvana"));

    await waitFor(() =>
      expect(Burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't find Nirvana" }),
      ),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("reports a failed lookup", async () => {
    mockGetLinks.mockRejectedValue(new ApiError(502, "MusicBrainz is down"));
    await openPage();

    await fireEvent.press(await screen.findByLabelText("Open album Nevermind"));

    await waitFor(() =>
      expect(Burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't open Nevermind",
          preset: "error",
        }),
      ),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("doesn't pull back someone who left during the lookup", async () => {
    let answerLookup: (links: object) => void = () => {};
    mockGetLinks.mockReturnValue(
      new Promise((resolve) => {
        answerLookup = resolve;
      }),
    );
    await openPage();

    await fireEvent.press(await screen.findByLabelText("Open artist Nirvana"));
    mockFocused = false;
    await act(async () => answerLookup({ artistMbid, albumMbid: null }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("opens one page when a name is tapped twice during the lookup", async () => {
    let answerLookup: (links: object) => void = () => {};
    mockGetLinks.mockReturnValue(
      new Promise((resolve) => {
        answerLookup = resolve;
      }),
    );
    await openPage();

    const link = await screen.findByLabelText("Open artist Nirvana");
    await fireEvent.press(link);
    await fireEvent.press(link);
    await act(async () => answerLookup({ artistMbid, albumMbid: null }));

    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("has no album link for a track with no album", async () => {
    await openPage(playlist({ tracks: [track({ albumName: null })] }));

    await screen.findByLabelText("Open artist Nirvana");
    expect(screen.queryByLabelText(/^Open album/)).toBeNull();
  });
});
