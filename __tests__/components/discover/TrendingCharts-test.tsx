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
  getTrendingCharts: jest.fn(),
}));

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  lookupLibraryArtists: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/lib/api/flow", () => ({
  ...jest.requireActual("@/lib/api/flow"),
  getFlowStatus: jest.fn(() =>
    Promise.resolve({ flows: [], sharedPlaylists: [{ id: "lib-1" }] }),
  ),
}));

jest.mock("@/lib/player/player", () => ({
  pause: jest.fn(),
  pauseClip: jest.fn(),
  playItem: jest.fn(() => Promise.resolve()),
  resume: jest.fn(),
  usePlayerStatus: () => ({}),
}));

// The test's Reanimated stub has none of what the skeleton animates with.
jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
  useSegments: () => ["(app)", "(tabs)", "(discover)"],
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
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
import { TrendingCharts } from "@/components/discover/TrendingCharts";
import { ApiError } from "@/lib/api/client";
import {
  addEditorialPlaylistToLibrary,
  getEditorialLinks,
  getTrendingCharts,
} from "@/lib/api/search";
import { pauseClip, playItem } from "@/lib/player/player";
import type {
  TrendingChartSong,
  TrendingChartsResponse,
} from "@/lib/types/search";

const mockGetCharts = getTrendingCharts as jest.Mock;
const mockAdd = addEditorialPlaylistToLibrary as jest.Mock;
const mockGetLinks = getEditorialLinks as jest.Mock;

function song(
  position: number,
  overrides: Partial<TrendingChartSong> = {},
): TrendingChartSong {
  return {
    key: `song-${position}`,
    position,
    trackName: `Song ${position}`,
    artistName: `Artist ${position}`,
    albumName: `Album ${position}`,
    deezerAlbumId: String(9000 + position),
    durationMs: 180000,
    artworkUrl: null,
    largeArtworkUrl: null,
    preview_url: `/api/deezer/preview/${position}.mp3`,
    movement: null,
    ...overrides,
  };
}

function charts(
  overrides: Partial<TrendingChartsResponse> = {},
): TrendingChartsResponse {
  return {
    region: "US",
    updatedAt: Date.now() - 2 * 60 * 60 * 1000,
    songs: {
      playlistId: "1313621735",
      playlistName: "Top USA",
      libraryPlaylistId: null,
      items: Array.from({ length: 12 }, (_, index) => song(index + 1)),
      spotlight: null,
    },
    albums: [
      {
        key: "a1",
        position: 1,
        name: "FRESH",
        artistName: "Lil Baby",
        artworkUrl: null,
        releaseDate: "2026-11-06",
        genre: "Hip-Hop/Rap",
      },
    ],
    genreShare: {
      total: 100,
      other: 12,
      genres: [
        { name: "Hip-Hop/Rap", count: 38 },
        { name: "Pop", count: 19 },
      ],
    },
    artists: [
      {
        key: "r1",
        position: 1,
        name: "Drake",
        imageUrl: null,
        mbid: "9fff2f8a-21e6-47de-a2b8-7f449929d43f",
        fans: 24129526,
      },
      {
        key: "r2",
        position: 2,
        name: "Unmatched",
        imageUrl: null,
        mbid: null,
        fans: null,
      },
    ],
    genres: [
      {
        id: 132,
        name: "Pop",
        covers: [],
        artists: ["STELLA LEFTY", "Ella Langley"],
      },
    ],
    ...overrides,
  };
}

const clients: QueryClient[] = [];

async function renderCharts(data: TrendingChartsResponse = charts()) {
  mockGetCharts.mockResolvedValue(data);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  clients.push(client);
  const tree = (active: boolean) => (
    <QueryClientProvider client={client}>
      <TrendingCharts active={active} />
    </QueryClientProvider>
  );
  await render(tree(true));
  // Discover keeps a tab mounted while another one shows.
  return { hide: () => screen.rerender(tree(false)) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCharts.mockReset();
  mockAdd.mockReset();
  mockGetLinks.mockReset();
  mockUser = { role: "user", permissions: { accessFlow: true } };
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("the charts", () => {
  it("leads with No. 1, then lists No. 2 to No. 10", async () => {
    await renderCharts();

    expect(await screen.findByText("Song 1")).toBeTruthy();
    expect(screen.getByText("No. 1")).toBeTruthy();
    expect(screen.getByLabelText("No. 2")).toBeTruthy();
    expect(screen.getByLabelText("No. 10")).toBeTruthy();
    expect(screen.queryByText("Song 11")).toBeNull();
    expect(screen.getByText("Show All 12")).toBeTruthy();
  });

  it("shows the region and when the charts were updated", async () => {
    await renderCharts();

    expect(
      await screen.findByText("United States · Updated 2 hours ago"),
    ).toBeTruthy();
  });

  it("shows each song's movement since the day before", async () => {
    const data = charts();
    data.songs!.items[1].movement = 3;
    data.songs!.items[2].movement = -1;
    data.songs!.items[3].movement = "new";

    await renderCharts(data);

    expect(await screen.findByLabelText("No. 2, up 3 places")).toBeTruthy();
    expect(screen.getByLabelText("No. 3, down 1 place")).toBeTruthy();
    expect(screen.getByLabelText("No. 4, new entry")).toBeTruthy();
    expect(screen.getByLabelText("No. 5")).toBeTruthy();
  });

  it("shows how long No. 1 has led once there is history", async () => {
    const data = charts();
    data.songs!.spotlight = {
      daysAtTop: 3,
      ranks: [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        4,
        1,
        1,
        1,
      ],
    };

    await renderCharts(data);

    expect(await screen.findByText("at No. 1")).toBeTruthy();
    expect(screen.getByLabelText("Charted 4 of the last 14 days")).toBeTruthy();
  });

  it("shows the album, artist and genre charts", async () => {
    await renderCharts();

    expect(await screen.findByText("FRESH")).toBeTruthy();
    expect(screen.getByText("No. 1 · 24M fans")).toBeTruthy();
    expect(screen.getByText("Top Pop")).toBeTruthy();
    expect(
      screen.getByText("STELLA LEFTY, Ella Langley and more"),
    ).toBeTruthy();
    expect(screen.getByText("Genres in the Top 100 Albums")).toBeTruthy();
    expect(screen.getByLabelText("Hip-Hop/Rap, 38 of 100 albums")).toBeTruthy();
  });

  it("holds a place for each chart Aurral hasn't loaded yet", async () => {
    await renderCharts(
      charts({
        region: null,
        updatedAt: null,
        songs: null,
        albums: null,
        genreShare: null,
        artists: null,
        genres: [],
      }),
    );

    await screen.findByText("Top Songs");
    expect(screen.getByText("Top Albums")).toBeTruthy();
    expect(screen.getByText("Top Artists")).toBeTruthy();
    expect(screen.getByText("Charts by Genre")).toBeTruthy();
    expect(
      screen.getAllByText("This chart is still loading. Check back soon."),
    ).toHaveLength(4);
    expect(screen.queryByText("Charts didn't load")).toBeNull();
  });

  it("offers a retry when the request fails", async () => {
    mockGetCharts
      .mockRejectedValueOnce(new ApiError(500, "boom"))
      .mockResolvedValue(charts());
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    clients.push(client);
    await render(
      <QueryClientProvider client={client}>
        <TrendingCharts />
      </QueryClientProvider>,
    );

    await fireEvent.press(await screen.findByText("Try Again"));

    expect(await screen.findByText("Song 1")).toBeTruthy();
  });
});

describe("Save as Playlist", () => {
  it("saves the songs chart, then links to the saved playlist", async () => {
    mockAdd.mockResolvedValue({
      playlistId: "lib-1",
      name: "Top USA (Deezer)",
      alreadyAdded: false,
      tracksQueued: 100,
    });
    await renderCharts();

    await fireEvent.press(await screen.findByText("Save as Playlist"));

    expect(mockAdd).toHaveBeenCalledWith("1313621735");
    // Taken from the save, not a reread that could still say unsaved.
    expect(await screen.findByText("Open in Library")).toBeTruthy();
    expect(mockGetCharts).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText("Open in Library"));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/(app)/(tabs)/(library)/playlists",
      ),
    );
  });

  it("links a chart saved earlier", async () => {
    const data = charts();
    data.songs!.libraryPlaylistId = "lib-1";

    await renderCharts(data);

    expect(await screen.findByText("Open in Library")).toBeTruthy();
    expect(screen.queryByText("Save as Playlist")).toBeNull();
  });

  it("isn't offered without playlist access", async () => {
    mockUser = { role: "user", permissions: { accessFlow: false } };

    await renderCharts();

    await screen.findByText("Song 1");
    expect(screen.queryByText("Save as Playlist")).toBeNull();
  });
});

describe("taps", () => {
  it("plays a song's preview", async () => {
    await renderCharts();

    await fireEvent.press(await screen.findByLabelText("Preview Song 2"));

    await waitFor(() =>
      expect(playItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Song 2",
          artist: "Artist 2",
          url: expect.stringContaining("/api/deezer/preview/2.mp3"),
        }),
      ),
    );
  });

  it("opens an artist's page only when it has an MBID", async () => {
    await renderCharts();

    await fireEvent.press(await screen.findByText("Unmatched"));
    expect(mockPush).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Drake"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/artist/[mbid]",
      params: { mbid: "9fff2f8a-21e6-47de-a2b8-7f449929d43f", name: "Drake" },
    });
  });

  it("looks an album up by name and opens it", async () => {
    mockGetLinks.mockResolvedValue({
      artistMbid: "artist-mbid",
      albumMbid: "album-mbid",
    });
    await renderCharts();

    await fireEvent.press(
      await screen.findByLabelText("No. 1, FRESH by Lil Baby"),
    );

    expect(mockGetLinks).toHaveBeenCalledWith({
      artist: "Lil Baby",
      album: "FRESH",
      albumId: null,
    });
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/release/[mbid]",
          params: expect.objectContaining({ mbid: "album-mbid" }),
        }),
      ),
    );
  });

  it("drops a lookup that answers after the tab is hidden", async () => {
    let answer: (links: object) => void = () => {};
    mockGetLinks.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { hide } = await renderCharts();

    await fireEvent.press(
      await screen.findByLabelText("No. 1, FRESH by Lil Baby"),
    );
    await hide();
    await act(async () =>
      answer({ artistMbid: "artist-mbid", albumMbid: "album-mbid" }),
    );

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("stops a preview when the tab is hidden", async () => {
    const { hide } = await renderCharts();
    await screen.findByText("Song 1");
    expect(pauseClip).not.toHaveBeenCalled();

    await hide();

    expect(pauseClip).toHaveBeenCalled();
  });

  it("opens the full songs chart and each genre's chart", async () => {
    await renderCharts();

    await fireEvent.press(await screen.findByText("Show All 12"));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: "/(app)/(tabs)/(discover)/trending/[chart]",
      params: { chart: "songs" },
    });

    await fireEvent.press(screen.getByLabelText("Open Top Pop"));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: "/(app)/(tabs)/(discover)/trending/[chart]",
      params: { chart: "132", name: "Pop" },
    });
  });
});
