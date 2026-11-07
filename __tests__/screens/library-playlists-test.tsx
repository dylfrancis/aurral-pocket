jest.mock("@/lib/api/client", () => ({
  ...jest.requireActual("@/lib/api/client"),
  api: { defaults: { baseURL: "http://server/api" }, get: jest.fn() },
}));

let mockUser: { role: string; permissions: { accessFlow: boolean } };
jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    serverUrl: "http://server",
    token: "token",
    user: mockUser,
  }),
}));

jest.mock("@/components/player/MiniPlayerHost", () => ({
  MiniPlayerHost: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@shopify/flash-list", () => {
  const { FlatList } = require("react-native");
  return { FlashList: FlatList };
});

// expo-router's testing library installs a Reanimated mock too thin for the
// page, so its content has its own suite. This one proves the route resolves.
jest.mock("@/components/flow/PlaylistDetailScreen", () => {
  const { Text } = require("react-native");
  return { PlaylistDetailScreen: () => <Text>The playlist page</Text> };
});

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from "expo-router/testing-library";
import LibraryLayout from "@/app/(app)/(tabs)/(library)/_layout";
import LibraryHome from "@/app/(app)/(tabs)/(library)/index";
import LibraryPlaylistsScreen, {
  ErrorBoundary,
} from "@/app/(app)/(tabs)/(library)/playlists";
import PlaylistRoute, {
  ErrorBoundary as PlaylistErrorBoundary,
} from "@/app/(app)/(tabs)/(library)/playlist/[id]";
import { api } from "@/lib/api/client";

const mockGet = api.get as jest.Mock;

const STATUS_PATH = "/playlists/status";

const ROAD_TRIP = {
  id: "pl-1",
  name: "Road Trip",
  trackCount: 2,
  tracks: [],
  recordHistory: true,
};

const statusResponse = {
  flows: [{ id: "flow-1", name: "Chill", enabled: true, scheduleDays: [] }],
  sharedPlaylists: [ROAD_TRIP],
  flowStats: {},
  sharedPlaylistStats: {},
  retryCyclePausedByPlaylist: {},
};

function serve(status: unknown = statusResponse) {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve({ data: path === STATUS_PATH ? status : [] }),
  );
}

const OtherRoute = () => null;

async function open(initialUrl: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  // Under the real groups, so the absolute paths the app pushes must resolve.
  const routes: Record<string, unknown> = {
    _layout: LibraryLayout,
    index: LibraryHome,
    playlists: { default: LibraryPlaylistsScreen, ErrorBoundary },
    "playlist/[id]": {
      default: PlaylistRoute,
      ErrorBoundary: PlaylistErrorBoundary,
    },
    "playlist-edit": OtherRoute,
    // The layout's other screens, so it finds every route it names.
    artists: OtherRoute,
    albums: OtherRoute,
    genres: OtherRoute,
    "genre/[genre]": OtherRoute,
    favorites: OtherRoute,
    blocklist: OtherRoute,
    "artist/[mbid]": OtherRoute,
    "album/[ref]": OtherRoute,
    "artist/albums": OtherRoute,
    "artist/releases": OtherRoute,
    "release/[mbid]": OtherRoute,
  };
  await renderRouter(
    Object.fromEntries(
      Object.entries(routes).map(([name, route]) => [
        `(app)/(tabs)/(library)/${name}`,
        route,
      ]),
    ) as never,
    {
      initialUrl,
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { role: "user", permissions: { accessFlow: true } };
  serve();
});

describe("Library > Playlists", () => {
  it("opens from the Library home and lists static playlists, not flows", async () => {
    await open("/");

    await fireEvent.press(screen.getByText("Playlists"));

    await waitFor(() => expect(screen.getByText("Road Trip")).toBeTruthy());
    expect(screen).toHavePathname("/playlists");
    expect(screen.queryByText("Chill")).toBeNull();
  });

  describe("without accessFlow", () => {
    beforeEach(() => {
      mockUser = { role: "user", permissions: { accessFlow: false } };
    });

    it("leaves the row off the Library home", async () => {
      await open("/");

      expect(screen.getByText("Favorites")).toBeTruthy();
      expect(screen.queryByText("Playlists")).toBeNull();
    });

    it("refuses a deep link without requesting the playlists", async () => {
      await open("/playlists");

      expect(
        screen.getByText("You don't have access to Playlists"),
      ).toBeTruthy();
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  it("explains the empty list without offering to create a flow", async () => {
    serve({ ...statusResponse, sharedPlaylists: [] });

    await open("/playlists");

    await waitFor(() =>
      expect(screen.getByText(/^No playlists yet/)).toBeTruthy(),
    );
    expect(screen.queryByText("Create Flow")).toBeNull();
  });

  it("opens a playlist's page", async () => {
    await open("/playlists");
    await waitFor(() => expect(screen.getByText("Road Trip")).toBeTruthy());

    await fireEvent.press(screen.getByText("Road Trip"));

    await waitFor(() =>
      expect(screen.getByText("The playlist page")).toBeTruthy(),
    );
    expect(screen).toHavePathname("/playlist/pl-1");
  });
});
