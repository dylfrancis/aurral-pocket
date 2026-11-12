jest.mock("burnt", () => ({ toast: jest.fn() }));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    serverUrl: "http://server",
    token: "token",
    user: { role: "admin" },
  }),
}));

jest.mock("@/lib/api/search", () => ({
  addEditorialPlaylistToLibrary: jest.fn(),
  getEditorialLinks: jest.fn(),
  getTrendingCharts: jest.fn(),
  getTrendingGenreChart: jest.fn(),
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

let mockParams: Record<string, string>;
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ isFocused: () => true }),
  useSegments: () => ["(app)", "(tabs)", "(discover)"],
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }),
  Stack: { Screen: () => null },
}));

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrendingChartScreen } from "@/components/discover/TrendingChartScreen";
import { ApiError } from "@/lib/api/client";
import { getTrendingCharts, getTrendingGenreChart } from "@/lib/api/search";
import type { TrendingSong } from "@/lib/types/search";

const mockGetCharts = getTrendingCharts as jest.Mock;
const mockGetGenre = getTrendingGenreChart as jest.Mock;

function song(position: number): TrendingSong {
  return {
    key: `song-${position}`,
    position,
    trackName: `Song ${position}`,
    artistName: `Artist ${position}`,
    albumName: null,
    deezerAlbumId: null,
    durationMs: null,
    artworkUrl: null,
    largeArtworkUrl: null,
    preview_url: null,
  };
}

const clients: QueryClient[] = [];

async function renderScreen(params: Record<string, string>) {
  mockParams = params;
  const client = new QueryClient({
    // The genre query sets its own retry, so make its retries immediate.
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <TrendingChartScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCharts.mockReset();
  mockGetGenre.mockReset();
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("Top Songs", () => {
  it("lists the whole chart with each song's movement", async () => {
    mockGetCharts.mockResolvedValue({
      region: "US",
      updatedAt: null,
      songs: {
        playlistId: "1313621735",
        playlistName: "Top USA",
        libraryPlaylistId: null,
        items: Array.from({ length: 12 }, (_, index) => ({
          ...song(index + 1),
          movement: index === 2 ? 4 : null,
        })),
        spotlight: null,
      },
      albums: null,
      genreShare: null,
      artists: null,
      genres: [],
    });

    await renderScreen({ chart: "songs" });

    expect(await screen.findByText("Song 1")).toBeTruthy();
    expect(screen.getByLabelText("No. 3, up 4 places")).toBeTruthy();
    expect(screen.getByText("Save as Playlist")).toBeTruthy();
  });

  it("holds a place while Aurral loads the chart", async () => {
    mockGetCharts.mockResolvedValue({
      region: null,
      updatedAt: null,
      songs: null,
      albums: null,
      genreShare: null,
      artists: null,
      genres: [],
    });

    await renderScreen({ chart: "songs" });

    expect(
      await screen.findByText("This chart is still loading. Check back soon."),
    ).toBeTruthy();
  });
});

describe("a genre chart", () => {
  it("lists the genre's songs by rank", async () => {
    mockGetGenre.mockResolvedValue({
      id: 132,
      name: "Pop",
      region: "US",
      updatedAt: 1794180681766,
      items: [song(1), song(2)],
    });

    await renderScreen({ chart: "132", name: "Pop" });

    expect(await screen.findByText("Song 2")).toBeTruthy();
    expect(mockGetGenre).toHaveBeenCalledWith("132");
    expect(screen.getByLabelText("No. 2")).toBeTruthy();
    expect(screen.queryByText("Save as Playlist")).toBeNull();
  });

  it("treats a chart the server hasn't loaded as loading, not an error", async () => {
    const pop = {
      id: 132,
      name: "Pop",
      region: "US",
      updatedAt: 1794180681766,
      items: [song(1)],
    };
    mockGetGenre.mockRejectedValue(
      new ApiError(404, "This genre chart isn't available yet"),
    );

    await renderScreen({ chart: "132", name: "Pop" });

    expect(
      await screen.findByText("This chart is still loading. Check back soon."),
    ).toBeTruthy();
    // Retrying a 404 only delays the placeholder.
    expect(mockGetGenre).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Try Again")).toBeNull();

    mockGetGenre.mockResolvedValue(pop);
    await fireEvent.press(screen.getByText("Check Again"));

    expect(await screen.findByText("Song 1")).toBeTruthy();
  });

  it("retries any other failure", async () => {
    mockGetGenre.mockRejectedValue(new ApiError(500, "boom"));

    await renderScreen({ chart: "132", name: "Pop" });
    expect(await screen.findByText("Try Again")).toBeTruthy();
    expect(mockGetGenre).toHaveBeenCalledTimes(3);

    mockGetGenre.mockResolvedValue({
      id: 132,
      name: "Pop",
      region: "US",
      updatedAt: 1794180681766,
      items: [song(1)],
    });
    await fireEvent.press(screen.getByText("Try Again"));

    expect(await screen.findByText("Song 1")).toBeTruthy();
  });
});

it("says so for a chart that doesn't exist", async () => {
  await renderScreen({ chart: "nope" });

  expect(screen.getByText("Unknown chart")).toBeTruthy();
  expect(mockGetGenre).not.toHaveBeenCalled();
});
