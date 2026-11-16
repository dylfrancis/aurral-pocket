jest.mock("@/lib/api/search", () => ({
  getEditorialShelf: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
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
import { getEditorialShelf } from "@/lib/api/search";
import type {
  EditorialCategory,
  EditorialPlaylistSummary,
} from "@/lib/types/search";

const mockGetShelf = getEditorialShelf as jest.Mock;

function playlistSummary(id: string, name: string): EditorialPlaylistSummary {
  return {
    provider: "deezer",
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
  playlists: [playlistSummary("4", "Chill Hits")],
};

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
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("EditorialShelf", () => {
  it("lists the user's row, then a shelf per genre", async () => {
    mockGetShelf.mockResolvedValue({
      forYou: [playlistSummary("1", "For Your Taste")],
      categories: [POP, CHILL, ROCK],
    });

    await renderScreen();

    expect(await screen.findByText("For You")).toBeTruthy();
    expect(screen.getByText("For Your Taste")).toBeTruthy();
    expect(screen.getByText("Pop")).toBeTruthy();
    expect(screen.getByText("Pop Hits")).toBeTruthy();
    expect(screen.getByText("Rock")).toBeTruthy();
    expect(screen.getByText("Rock Hits")).toBeTruthy();
    expect(screen.queryByText("Chill")).toBeNull();
    expect(screen.queryByText("View All")).toBeNull();
  });

  it("adds the rails below the first few after the tab opens", async () => {
    const categories = ["Pop", "Rock", "Jazz", "Soul", "Metal"].map(
      (name, index): EditorialCategory => ({
        id: `genre-${index + 1}`,
        name,
        group: "genre",
        playlists: [playlistSummary(String(index + 10), `${name} Hits`)],
      }),
    );
    mockGetShelf.mockResolvedValue({ forYou: [], categories });

    await renderScreen();

    expect(await screen.findByText("Metal Hits")).toBeTruthy();
    expect(screen.getByText("Pop Hits")).toBeTruthy();
  });

  it("leaves out an empty For You", async () => {
    mockGetShelf.mockResolvedValue({ forYou: [], categories: [POP] });

    await renderScreen();

    await screen.findByText("Pop");
    expect(screen.queryByText("For You")).toBeNull();
  });

  it("says so when there are no playlists at all", async () => {
    mockGetShelf.mockResolvedValue({ forYou: [], categories: [] });

    await renderScreen();

    expect(await screen.findByText("No playlists right now")).toBeTruthy();
  });

  it("offers a retry when the shelf fails to load", async () => {
    mockGetShelf.mockRejectedValueOnce(new ApiError(502, "Deezer is down"));

    await renderScreen();
    expect(await screen.findByText("Playlists didn't load")).toBeTruthy();

    mockGetShelf.mockResolvedValue({ forYou: [], categories: [POP] });
    await fireEvent.press(screen.getByText("Try Again"));

    expect(await screen.findByText("Pop")).toBeTruthy();
  });
});
