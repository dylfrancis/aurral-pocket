jest.mock("burnt", () => ({ toast: jest.fn() }));

let mockUser: {
  role: string;
  permissions: { accessPlaylists: boolean; addAlbum: boolean };
};
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

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  requestTrackDownload: jest.fn(),
}));

// The track actions sheet; no test here opens it.
jest.mock("@/components/library/TrackActionsSheet", () => ({
  TrackActionsSheet: () => null,
  useTrackActions: () => ({
    target: null,
    open: jest.fn(),
    openItem: jest.fn(),
    close: jest.fn(),
  }),
}));

jest.mock("@/lib/api/flow", () => ({
  ...jest.requireActual("@/lib/api/flow"),
  getFlowStatus: jest.fn(() =>
    Promise.resolve({ flows: [], staticPlaylists: [] }),
  ),
}));

let mockCurrentId: string | null = null;
jest.mock("@/lib/player/player", () => ({
  pauseClip: jest.fn(),
  playItem: jest.fn(() => Promise.resolve()),
  playQueueFrom: jest.fn(() => Promise.resolve(true)),
  togglePlayback: jest.fn(() => Promise.resolve()),
  useCurrentTrack: () => (mockCurrentId ? { id: mockCurrentId } : null),
  usePlaybackState: () => (mockCurrentId ? "playing" : "stopped"),
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
  ...require("@/test-support/expo-router-stack"),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ isFocused: () => mockFocused }),
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
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
import { ApiError, setAuthToken, setBaseUrl } from "@/lib/api/client";
import { requestTrackDownload } from "@/lib/api/library";
import {
  addEditorialPlaylistToLibrary,
  getEditorialLinks,
  getEditorialPlaylist,
} from "@/lib/api/search";
import {
  pauseClip,
  playItem,
  playQueueFrom,
  togglePlayback,
} from "@/lib/player/player";
import { flowKeys } from "@/lib/query-keys";
import type { LibraryQueueTrack } from "@/lib/types/library";
import type { EditorialPlaylist, EditorialTrack } from "@/lib/types/search";

const mockGetPlaylist = getEditorialPlaylist as jest.Mock;
const mockAdd = addEditorialPlaylistToLibrary as jest.Mock;
const mockGetLinks = getEditorialLinks as jest.Mock;
const mockRequestDownload = requestTrackDownload as jest.Mock;
const ADD = "Add 90s Hits to your Library";
const OPEN = "Open 90s Hits in your Library";

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

function playlist(
  overrides: Partial<EditorialPlaylist> = {},
): EditorialPlaylist {
  return {
    provider: "deezer",
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
  mockUser = {
    role: "user",
    permissions: { accessPlaylists: true, addAlbum: true },
  };
  mockParams = { provider: "deezer", id: "878" };
  mockFocused = true;
  mockCurrentId = null;
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("the page itself", () => {
  it("paints the card's name while the playlist loads", async () => {
    mockParams = {
      provider: "deezer",
      id: "878",
      name: "From the card",
      trackCount: "12",
    };
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

  it.each([
    ["deezer", "Deezer no longer has this playlist"],
    ["discovery", "This playlist was replaced by a newer one"],
    ["mix", "This mix was replaced by a newer one"],
  ] as const)(
    "explains a %s playlist that's gone, with nothing to retry",
    async (provider, message) => {
      mockParams = { provider, id: "878" };
      mockGetPlaylist.mockRejectedValue(new ApiError(404, "gone"));

      await renderPage();

      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.queryByText("Try Again")).toBeNull();
    },
  );

  it("reads and saves the playlist under the provider it was opened with", async () => {
    mockParams = { provider: "mix", id: "daily-1" };
    mockAdd.mockResolvedValue({
      playlistId: "lib-1",
      name: "Daily Mix 1",
      alreadyAdded: false,
      tracksQueued: 0,
    });
    await openPage(
      playlist({ provider: "mix", id: "daily-1", name: "Daily Mix 1" }),
    );

    await fireEvent.press(
      await screen.findByLabelText("Add Daily Mix 1 to your Library"),
    );

    await screen.findByLabelText("Open Daily Mix 1 in your Library");
    expect(mockGetPlaylist).toHaveBeenCalledWith("mix", "daily-1");
    expect(mockAdd).toHaveBeenCalledWith("mix", "daily-1");
    // A mix syncs with Aurral, not Deezer.
    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Syncs daily" }),
    );
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

describe("songs the Library doesn't have", () => {
  // A clip's URL carries the session token.
  beforeEach(() => {
    setBaseUrl("http://server");
    setAuthToken("token");
  });

  afterEach(() => {
    setBaseUrl("");
    setAuthToken(null);
  });

  it("grays them, and a song with no clip can't be tapped", async () => {
    await openPage(
      playlist({
        tracks: [
          track({ trackName: "Lithium" }),
          track({ trackName: "Polly", preview_url: null }),
        ],
      }),
    );

    await fireEvent.press(
      await screen.findByLabelText("Polly, not in your Library"),
    );

    expect(screen.getByLabelText("Lithium, not in your Library")).toBeTruthy();
    expect(playItem).not.toHaveBeenCalled();
  });

  it("plays a tapped song's clip alone, with its details", async () => {
    await openPage();

    await fireEvent.press(
      await screen.findByLabelText("Lithium, not in your Library"),
    );

    await waitFor(() =>
      expect(playItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Lithium",
          artist: "Nirvana",
          album: "Nevermind",
          artwork: "https://cdn.example/nevermind.jpg",
          url: expect.stringContaining("/api/deezer/preview/1.mp3"),
          isPreview: true,
        }),
      ),
    );
    expect(playQueueFrom).not.toHaveBeenCalled();
  });

  it("keeps two rows of the same song apart", async () => {
    mockCurrentId = "deezer-878-1";
    await openPage(
      playlist({
        tracks: [
          track({ trackName: "Same Song" }),
          track({ trackName: "Same Song" }),
        ],
      }),
    );
    const [first, second] = await screen.findAllByLabelText(
      "Same Song, not in your Library",
    );

    await fireEvent.press(second);
    expect(togglePlayback).toHaveBeenCalledTimes(1);
    expect(playItem).not.toHaveBeenCalled();

    await fireEvent.press(first);
    expect(playItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "deezer-878-0" }),
    );
  });

  it("asks Aurral to find and download one from its ↓", async () => {
    mockRequestDownload.mockResolvedValue({ success: true, queued: true });
    await openPage();

    await fireEvent.press(await screen.findByLabelText("Download Lithium"));

    expect(mockRequestDownload).toHaveBeenCalledWith({
      artistName: "Nirvana",
      trackName: "Lithium",
      albumName: "Nevermind",
    });
    expect(await screen.findByLabelText("Lithium is downloading")).toBeTruthy();
    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Downloading Lithium" }),
    );
  });

  it("downloads every missing song from the menu, skipping owned and already asked-for ones", async () => {
    mockRequestDownload.mockResolvedValue({ success: true, queued: true });
    await openPage(
      playlist({
        tracks: [
          track({ trackName: "Lithium" }),
          track({ trackName: "Polly" }),
          track({ trackName: "Breed" }),
          track({
            trackName: "Drain You",
            owned: { id: "42" } as LibraryQueueTrack,
          }),
        ],
      }),
    );
    await fireEvent.press(await screen.findByLabelText("Download Lithium"));
    await screen.findByLabelText("Lithium is downloading");

    await fireEvent.press(
      screen.getByRole("menuitem", { name: "Download Missing Songs (2)" }),
    );

    await waitFor(() => expect(mockRequestDownload).toHaveBeenCalledTimes(3));
    expect(
      mockRequestDownload.mock.calls.slice(1).map(([song]) => song.trackName),
    ).toEqual(["Polly", "Breed"]);
    await waitFor(() =>
      expect(Burnt.toast).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Downloading 2 songs" }),
      ),
    );
    expect(
      screen.queryByRole("menuitem", { name: /Download Missing/ }),
    ).toBeNull();
  });

  it("offers no ↓ to someone who can't add music", async () => {
    mockUser = {
      role: "user",
      permissions: { accessPlaylists: true, addAlbum: false },
    };
    await openPage();

    await screen.findByLabelText("Lithium, not in your Library");
    expect(screen.queryByLabelText("Download Lithium")).toBeNull();
  });

  it("stops the clip when the page closes", async () => {
    const { view } = await openPage();

    await view.unmount();

    expect(pauseClip).toHaveBeenCalled();
  });
});

describe("tracks in the Library", () => {
  const owned: LibraryQueueTrack = {
    id: "42",
    title: "Lithium",
    artist: "Nirvana",
    album: "Nevermind",
    streamPath: "/library/stream/7/42",
    streamFormat: "flac",
    quality: "FLAC",
    durationMs: 257000,
    artistMbid: "artist-mbid",
    albumMbid: "album-mbid",
    trackMbid: "track-mbid",
    libraryTrackId: 42,
    libraryAlbumId: 7,
    libraryArtistId: 3,
    artworkUrl: "/api/library/artwork/album/7",
    artworkSource: "album",
  };

  beforeEach(() => {
    setBaseUrl("http://server");
    setAuthToken("token");
  });

  afterEach(() => {
    setBaseUrl("");
    setAuthToken(null);
  });

  const ownedPolly: LibraryQueueTrack = {
    ...owned,
    id: "43",
    title: "Polly",
    streamPath: "/library/stream/7/43",
    libraryTrackId: 43,
  };
  const mixedPlaylist = () =>
    playlist({
      tracks: [
        track({ owned }),
        track({ trackName: "Breed" }),
        track({ trackName: "Polly", owned: ownedPolly }),
      ],
    });
  const queuedIds = () =>
    (playQueueFrom as jest.Mock).mock.calls[0][0].map(
      (item: { id: string }) => item.id,
    );

  it("plays the Library's songs from the tapped one, skipping the rest", async () => {
    await openPage(mixedPlaylist());

    await fireEvent.press(await screen.findByLabelText("Polly"));

    await waitFor(() => expect(playQueueFrom).toHaveBeenCalled());
    expect(queuedIds()).toEqual(["42", "43"]);
    const [queue, startId, context] = (playQueueFrom as jest.Mock).mock
      .calls[0];
    expect(startId).toBe("43");
    expect(queue[0]).toMatchObject({
      streamPath: "/library/stream/7/42",
      url: "http://server/api/library/stream/7/42?token=token",
      trackMbid: "track-mbid",
      albumRef: "7",
    });
    expect(context).toMatchObject({ albumTitle: "90s Hits" });
    expect(playItem).not.toHaveBeenCalled();
  });

  it("plays and shuffles only the Library's songs from the top", async () => {
    await openPage(mixedPlaylist());

    await fireEvent.press(await screen.findByLabelText("Shuffle 90s Hits"));

    await waitFor(() => expect(playQueueFrom).toHaveBeenCalled());
    expect((playQueueFrom as jest.Mock).mock.calls[0][3]).toEqual({
      shuffle: true,
    });
    expect(queuedIds()).toEqual(["42", "43"]);
  });

  it("can't play from the top with nothing in the Library", async () => {
    await openPage();

    await fireEvent.press(await screen.findByLabelText("Play 90s Hits"));

    expect(playQueueFrom).not.toHaveBeenCalled();
  });

  it("pauses the Library song when it's already playing", async () => {
    mockCurrentId = "42";
    await openPage(playlist({ tracks: [track({ owned })] }));

    await fireEvent.press(await screen.findByLabelText("Lithium"));

    expect(togglePlayback).toHaveBeenCalled();
    expect(playQueueFrom).not.toHaveBeenCalled();
  });
});

describe("the + that saves the playlist", () => {
  it("saves the playlist and switches the page over without rereading it", async () => {
    mockAdd.mockResolvedValue({
      playlistId: "lib-1",
      name: "90s Hits",
      alreadyAdded: false,
      tracksQueued: 100,
    });
    const { client } = await openPage();
    client.setQueryDefaults(flowKeys.status(), { gcTime: Infinity });
    client.setQueryData(flowKeys.status(), { flows: [], staticPlaylists: [] });

    await fireEvent.press(await screen.findByLabelText(ADD));

    expect(await screen.findByLabelText(OPEN)).toBeTruthy();
    expect(screen.queryByLabelText(ADD)).toBeNull();
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

    await fireEvent.press(await screen.findByLabelText(ADD));

    await screen.findByLabelText(OPEN);
    expect(Burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Already in your playlists" }),
    );
  });

  it("keeps the button when the save fails", async () => {
    mockAdd.mockRejectedValue(new ApiError(502, "Deezer is down"));
    await openPage();

    await fireEvent.press(await screen.findByLabelText(ADD));

    await waitFor(() =>
      expect(Burnt.toast).toHaveBeenCalledWith({
        title: "Couldn't add playlist",
        message: "Deezer is down",
        preset: "error",
      }),
    );
    expect(screen.getByLabelText(ADD)).toBeTruthy();
  });

  it("can't add before the page knows whether it's already saved", async () => {
    mockParams = { provider: "deezer", id: "878", name: "From the card" };
    mockGetPlaylist.mockReturnValue(new Promise(() => {}));

    await renderPage();
    await fireEvent.press(
      screen.getByLabelText("Add From the card to your Library"),
    );

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("opens Library > Playlists for a saved playlist", async () => {
    await openPage(playlist({ libraryPlaylistId: "lib-1" }));

    await fireEvent.press(await screen.findByLabelText(OPEN));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/(app)/(tabs)/(library)/playlists",
      ),
    );
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it.each([null, "lib-1"])(
    "offers nothing without accessPlaylists (saved as %s)",
    async (libraryPlaylistId) => {
      mockUser = {
        role: "user",
        permissions: { accessPlaylists: false, addAlbum: true },
      };

      await openPage(playlist({ libraryPlaylistId }));

      await screen.findByText("Lithium");
      expect(screen.queryByLabelText(ADD)).toBeNull();
      expect(screen.queryByLabelText(OPEN)).toBeNull();
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
