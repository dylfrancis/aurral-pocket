jest.mock("@/lib/api/search", () => ({
  getEditorialShelf: jest.fn(),
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
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditorialPlaylistsSection } from "@/components/discover/EditorialPlaylistsSection";
import { ApiError } from "@/lib/api/client";
import { getEditorialShelf } from "@/lib/api/search";
import type { EditorialPlaylistSummary } from "@/lib/types/search";

const mockGetShelf = getEditorialShelf as jest.Mock;

function playlistSummary(id: string, name: string): EditorialPlaylistSummary {
  return {
    id,
    name,
    description: null,
    trackCount: 40,
    artworkUrl: `https://cdn.example/${id}.jpg`,
    curator: null,
  };
}

const POP = {
  id: 132,
  name: "Pop",
  playlists: [playlistSummary("2", "Pop Hits")],
};
const ROCK = {
  id: 152,
  name: "Rock",
  playlists: [playlistSummary("3", "Rock Hits")],
};

const clients: QueryClient[] = [];
const onViewAll = jest.fn();

async function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <EditorialPlaylistsSection onViewAll={onViewAll} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("EditorialPlaylistsSection", () => {
  it("shows the user's own row when there is one", async () => {
    mockGetShelf.mockResolvedValue({
      forYou: [playlistSummary("1", "For Your Taste")],
      genres: [POP],
    });

    await renderSection();

    expect(screen.getByText("For Your Taste")).toBeTruthy();
    expect(screen.queryByText("Pop Hits")).toBeNull();
  });

  it("falls back to the first genre only", async () => {
    mockGetShelf.mockResolvedValue({ forYou: [], genres: [POP, ROCK] });

    await renderSection();

    expect(screen.getByText("Pop Hits")).toBeTruthy();
    expect(screen.queryByText("Rock Hits")).toBeNull();
  });

  it.each([
    [
      "nothing to show",
      () => mockGetShelf.mockResolvedValue({ forYou: [], genres: [] }),
    ],
    [
      "a failed load",
      () => mockGetShelf.mockRejectedValue(new ApiError(502, "down")),
    ],
  ])("hides the section on %s", async (_name, arrange) => {
    arrange();

    await renderSection();

    expect(screen.queryByText("Playlists")).toBeNull();
  });

  it("opens a playlist with what its page paints first", async () => {
    mockGetShelf.mockResolvedValue({ forYou: [], genres: [POP] });

    await renderSection();
    await fireEvent.press(screen.getByLabelText("Open Pop Hits"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(discover)/editorial/[id]",
      params: {
        id: "2",
        name: "Pop Hits",
        artworkUrl: "https://cdn.example/2.jpg",
        trackCount: "40",
      },
    });
  });

  it("reaches View All from the header and the end of the row", async () => {
    mockGetShelf.mockResolvedValue({ forYou: [], genres: [POP] });

    await renderSection();
    await fireEvent.press(screen.getByText("Playlists"));
    await fireEvent.press(screen.getByText("View All"));

    expect(onViewAll).toHaveBeenCalledTimes(2);
  });
});
