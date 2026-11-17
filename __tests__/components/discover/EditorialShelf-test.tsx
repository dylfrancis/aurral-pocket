jest.mock("@/lib/api/search", () => ({
  getEditorialShelf: jest.fn(),
  getMadeForYou: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditorialShelf } from "@/components/discover/EditorialShelf";
import { ApiError } from "@/lib/api/client";
import { getEditorialShelf, getMadeForYou } from "@/lib/api/search";
import type {
  EditorialCategory,
  EditorialPlaylistSummary,
} from "@/lib/types/search";

const mockGetShelf = getEditorialShelf as jest.Mock;
const mockGetMadeForYou = getMadeForYou as jest.Mock;

function playlistSummary(
  id: string,
  name: string,
  provider: EditorialPlaylistSummary["provider"] = "deezer",
): EditorialPlaylistSummary {
  return {
    provider,
    id,
    name,
    description: null,
    trackCount: 40,
    artworkUrl: null,
    curator: null,
  };
}

const POP: EditorialCategory = {
  id: "genre-132",
  name: "Pop",
  group: "genre",
  playlists: [playlistSummary("2", "Pop Hits")],
};
const ROCK: EditorialCategory = {
  id: "genre-152",
  name: "Rock",
  group: "genre",
  playlists: [playlistSummary("3", "Rock Hits")],
};
const CHILL: EditorialCategory = {
  id: "mood-chill",
  name: "Chill",
  group: "mood",
  playlists: [
    playlistSummary("4", "Chill Hits"),
    playlistSummary("5", "Lofi Chill"),
  ],
};
const SIXTIES: EditorialCategory = {
  id: "decade-60s",
  name: "60s",
  group: "decade",
  playlists: [playlistSummary("6", "60s Hits")],
};

const RAIL_TITLES = /^(Made for You|Your Genres|Moods|Decades|Genres)$/;

/** The rail titles, top to bottom. */
function railTitles() {
  return screen
    .getAllByText(RAIL_TITLES)
    .map((node) =>
      [node.props.children].flat().filter((part) => typeof part === "string"),
    )
    .flat();
}

const clients: QueryClient[] = [];

async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <EditorialShelf />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMadeForYou.mockResolvedValue({ discovery: [], mixes: [] });
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("EditorialShelf", () => {
  it("lists Made for You and Your Genres, then a rail of categories per group", async () => {
    mockGetMadeForYou.mockResolvedValue({
      discovery: [playlistSummary("new-to-you", "New to You", "discovery")],
      mixes: [],
    });
    mockGetShelf.mockResolvedValue({
      forYou: [playlistSummary("1", "For Your Taste")],
      categories: [POP, CHILL, ROCK, SIXTIES],
    });

    await renderScreen();

    // The last rail is built a frame later.
    await screen.findByText("Genres");
    expect(railTitles()).toEqual([
      "Made for You",
      "Your Genres",
      "Moods",
      "Decades",
      "Genres",
    ]);
    expect(screen.getByText("New to You")).toBeTruthy();
    expect(screen.getByText("For Your Taste")).toBeTruthy();
    // The group rails hold categories, not their playlists.
    expect(screen.getByLabelText("Open Chill")).toBeTruthy();
    expect(screen.getByText("2 playlists")).toBeTruthy();
    expect(screen.getByLabelText("Open 60s")).toBeTruthy();
    expect(screen.getByLabelText("Open Rock")).toBeTruthy();
    expect(screen.queryByText("Chill Hits")).toBeNull();
  });

  it("opens a category from its card, and its group's first from the title", async () => {
    mockGetShelf.mockResolvedValue({ forYou: [], categories: [POP, ROCK] });

    await renderScreen();
    await fireEvent.press(await screen.findByLabelText("Open Rock"));
    await fireEvent.press(screen.getByText("Genres"));

    expect(mockPush.mock.calls).toEqual([
      [
        {
          pathname: "/(app)/(tabs)/(discover)/browse/[group]",
          params: { group: "genre", category: "genre-152", name: "Rock" },
        },
      ],
      [
        {
          pathname: "/(app)/(tabs)/(discover)/browse/[group]",
          params: { group: "genre", category: "genre-132", name: "Pop" },
        },
      ],
    ]);
  });

  it("adds the rails below the first few after the tab opens", async () => {
    mockGetShelf.mockResolvedValue({
      forYou: [playlistSummary("1", "For Your Taste")],
      categories: [CHILL, SIXTIES, POP],
    });

    await renderScreen();

    expect(await screen.findByLabelText("Open Pop")).toBeTruthy();
    expect(screen.getByText("For Your Taste")).toBeTruthy();
  });

  it("leaves out an empty Your Genres", async () => {
    mockGetShelf.mockResolvedValue({ forYou: [], categories: [POP] });

    await renderScreen();

    await screen.findByText("Genres");
    expect(screen.queryByText("Your Genres")).toBeNull();
  });

  it("says so when there are no playlists at all", async () => {
    mockGetShelf.mockResolvedValue({ forYou: [], categories: [] });

    await renderScreen();

    expect(await screen.findByText("No playlists right now")).toBeTruthy();
  });

  it("keeps Made for You and offers a retry when the shelf fails to load", async () => {
    mockGetMadeForYou.mockResolvedValue({
      discovery: [],
      mixes: [playlistSummary("daily-1", "Daily Mix 1", "mix")],
    });
    mockGetShelf.mockRejectedValueOnce(new ApiError(502, "Deezer is down"));

    await renderScreen();
    expect(await screen.findByText("Playlists didn't load")).toBeTruthy();
    expect(screen.getByText("Daily Mix 1")).toBeTruthy();

    mockGetShelf.mockResolvedValue({ forYou: [], categories: [POP] });
    await fireEvent.press(screen.getByText("Try Again"));

    expect(await screen.findByLabelText("Open Pop")).toBeTruthy();
  });
});
