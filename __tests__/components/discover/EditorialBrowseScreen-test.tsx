const mockSetOptions = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/api/search", () => ({
  getEditorialShelf: jest.fn(),
}));

jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));

// The real pills are SwiftUI and Compose views.
jest.mock("@/components/ui/PillRow", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    PillRow: ({ items, selected, onSelect }: any) =>
      React.createElement(
        View,
        null,
        items.map((item: any) =>
          React.createElement(
            Pressable,
            {
              key: item.id,
              accessibilityRole: "tab",
              accessibilityState: { selected: item.id === selected },
              onPress: () => onSelect(item.id),
            },
            React.createElement(Text, null, item.label),
          ),
        ),
      ),
  };
});

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditorialBrowseScreen } from "@/components/discover/EditorialBrowseScreen";
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

function category(
  id: string,
  name: string,
  group: EditorialCategory["group"],
  playlistName: string,
): EditorialCategory {
  return {
    id,
    name,
    group,
    playlists: [playlistSummary(id, playlistName)],
  };
}

const CATEGORIES = [
  category("genre-132", "Pop", "genre", "Pop Hits"),
  category("mood-chill", "Chill", "mood", "Chill Hits"),
  category("mood-focus", "Focus", "mood", "Deep Focus"),
];

const clients: QueryClient[] = [];

async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <EditorialBrowseScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetShelf.mockResolvedValue({ forYou: [], categories: CATEGORIES });
});

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("EditorialBrowseScreen", () => {
  it("opens on the tapped category, with its group's categories as pills", async () => {
    mockParams = { group: "mood", category: "mood-focus", name: "Focus" };

    await renderScreen();

    expect(await screen.findByText("Deep Focus")).toBeTruthy();
    expect(screen.queryByText("Chill Hits")).toBeNull();
    expect(screen.getAllByRole("tab").map((pill) => pill.props)).toEqual([
      expect.objectContaining({ accessibilityState: { selected: false } }),
      expect.objectContaining({ accessibilityState: { selected: true } }),
    ]);
    expect(screen.getByText("Chill")).toBeTruthy();
    expect(screen.queryByText("Pop")).toBeNull();
  });

  it("switches category, and the title, from a pill", async () => {
    mockParams = { group: "mood", category: "mood-focus", name: "Focus" };
    await renderScreen();
    await screen.findByText("Deep Focus");

    await fireEvent.press(screen.getByText("Chill"));

    expect(screen.getByText("Chill Hits")).toBeTruthy();
    expect(screen.queryByText("Deep Focus")).toBeNull();
    expect(mockSetOptions).toHaveBeenLastCalledWith({ title: "Chill" });
  });

  it("opens the group's first category when the tapped one is gone", async () => {
    mockParams = { group: "mood", category: "mood-sleep", name: "Sleep" };

    await renderScreen();

    expect(await screen.findByText("Chill Hits")).toBeTruthy();
    expect(mockSetOptions).toHaveBeenLastCalledWith({ title: "Chill" });
  });
});
