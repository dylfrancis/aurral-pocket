const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/library/CoverArtImage", () => ({
  CoverArtImage: () => null,
}));

// A test id carrying the URL, so a test can tell which image a row loaded.
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: ({ source }: { source?: { uri?: string } }) => (
      <View testID={`image:${source?.uri}`} />
    ),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The sheet's native parts stand in as plain views.
jest.mock("@/components/ui/AppSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AppSheet: React.forwardRef(function MockAppSheet(
      { children }: { children: React.ReactNode },
      _ref: unknown,
    ) {
      return React.createElement(View, null, children);
    }),
  };
});
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    BottomSheetView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});
jest.mock("@/components/flow/AddToPlaylistSheet", () => ({
  AddToPlaylistSheet: () => null,
  useAddToPlaylist: () => ({
    canAddToPlaylist: false,
    track: null,
    open: jest.fn(),
    close: jest.fn(),
  }),
}));

jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  getAlbumCover: jest.fn(() => Promise.resolve({ images: [] })),
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAlbumCover } from "@/lib/api/library";
import { OfflineScreen } from "@/components/offline/OfflineScreen";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import {
  forgetSavedLibrary,
  saveAlbum,
  savePlaylist,
  saveSong,
  setSavedLibraryUser,
} from "@/lib/offline/saved-library";
import { forgetQueue } from "@/lib/player/player";
import { PlayerQueue } from "react-native-nitro-player";
import { downloads } from "@/test-support/expo-file-system";
import type { FlowJob } from "@/lib/types/flow";
import type { Track } from "@/lib/types/library";

/** Lets the saved library's reads, writes and downloads land. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OfflineScreen />
    </QueryClientProvider>,
  );
}

async function finishDownloads(bytes: number) {
  while (downloads.length > 0) {
    downloads.shift()!.finish(bytes);
    await settle();
  }
}

function track(id: string): Track {
  return {
    id,
    mbid: `mb-${id}`,
    trackName: `Track ${id}`,
    title: `Track ${id}`,
    trackNumber: 1,
    hasFile: true,
    size: 400_000_000,
    quality: "FLAC",
    streamPath: `/library/canonical-stream/12/${id}`,
    streamFormat: "flac",
  };
}

const route = {
  title: "Kid A",
  artistName: "Radiohead",
  artistMbid: "artist-mb",
  albumMbid: "album-mb",
  coverUrl: "/api/library/albums/12/cover",
  lidarrAlbumId: "",
  canonicalAlbumId: "12",
  artistId: "",
};

beforeEach(async () => {
  setBaseUrl("https://music.example");
  setAuthToken("session-token");
  setSavedLibraryUser(1);
  await settle();
});

afterEach(async () => {
  // The player keeps its queue between tests otherwise.
  await forgetQueue();
  await forgetSavedLibrary();
  setSavedLibraryUser(null);
  mockPush.mockClear();
});

it("lists what the account saved with its size, and opens an album the way it was saved", async () => {
  saveAlbum({ ref: "12", route, tracks: [track("71"), track("72")] });
  savePlaylist({
    playlist: {
      id: "pl-1",
      name: "Road Trip",
      sourceName: null,
      sourceFlowId: null,
      trackCount: 1,
      recordHistory: true,
    },
    jobs: [{ id: "job-1", status: "done" } as FlowJob],
  });
  await settle();
  await finishDownloads(400_000_000);

  await renderScreen();

  expect(screen.getByText("1.2 GB on this phone")).toBeTruthy();
  expect(screen.getByText("Radiohead · 800 MB")).toBeTruthy();
  expect(screen.getByText("1 track · 400 MB")).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByText("Kid A"));
  });
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/album/[ref]",
    params: { ref: "12", ...route },
  });
});

it("plays the saved songs from their files, starting at the one tapped", async () => {
  const song = (id: string, title: string) => ({
    id,
    title,
    artist: "Massive Attack",
    album: "Mezzanine",
    duration: 0,
    url: "https://music.example/stream",
    artwork: null,
    streamPath: `/library/canonical-stream/30/${id}`,
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
    favorite: null,
    audioFormat: "FLAC",
  });
  saveSong(song("s1", "Angel"));
  saveSong(song("s2", "Teardrop"));
  await settle();
  await finishDownloads(40_000_000);

  await renderScreen();
  await act(async () => {
    fireEvent.press(screen.getByText("Teardrop"));
    await settle();
  });

  const [, queued] = (PlayerQueue.addTracksToPlaylist as jest.Mock).mock
    .calls[0];
  expect(
    queued.map(({ id, url }: { id: string; url: string }) => [id, url]),
  ).toEqual(
    expect.arrayContaining([
      ["s1", "/documents/saved-offline/s1.flac"],
      ["s2", "/documents/saved-offline/s2.flac"],
    ]),
  );
  expect(PlayerQueue.loadPlaylist).toHaveBeenCalledWith(
    "playlist-1",
    queued.findIndex(({ id }: { id: string }) => id === "s2"),
  );
});

it("shows a saved song's cover, and looks one up and keeps it for a song saved without", async () => {
  const song = (id: string, title: string, artwork: string | null) => ({
    id,
    title,
    artist: "Massive Attack",
    album: "Mezzanine",
    duration: 0,
    url: "https://music.example/stream",
    artwork,
    streamPath: `/library/canonical-stream/30/${id}`,
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: `album-${id}`,
    favorite: null,
    audioFormat: "FLAC",
  });
  const found = "https://img.example/album-s2.jpg";
  (getAlbumCover as jest.Mock).mockResolvedValue({
    images: [{ image: found, front: true }],
  });
  saveSong(song("s1", "Angel", "https://img.example/album-s1.jpg"));
  saveSong(song("s2", "Teardrop", null));
  await settle();
  await finishDownloads(40_000_000);

  await renderScreen();
  expect(
    screen.getByTestId("image:https://img.example/album-s1.jpg"),
  ).toBeTruthy();
  expect(screen.queryByTestId(`image:${found}`)).toBeNull();

  await act(async () => {
    fireEvent.press(screen.getByText("Teardrop"));
    await settle();
  });

  // Looked up with the names, which the server needs to find it.
  expect(getAlbumCover).toHaveBeenCalledWith("album-s2", {
    artistName: "Massive Attack",
    albumTitle: "Mezzanine",
  });
  expect(screen.getByTestId(`image:${found}`)).toBeTruthy();
});

it("opens a saved song's ⋯ on an album song's sheet, to queue it or take it off the phone", async () => {
  saveSong({
    id: "s1",
    title: "Teardrop",
    artist: "Massive Attack",
    album: "Mezzanine",
    duration: 0,
    url: "https://music.example/stream",
    artwork: null,
    streamPath: "/library/canonical-stream/30/s1",
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
    favorite: null,
    audioFormat: "FLAC",
  });
  await settle();
  await finishDownloads(40_000_000);
  await renderScreen();

  await fireEvent.press(screen.getByLabelText("More actions for Teardrop"));
  await act(async () => {
    fireEvent.press(screen.getByText("Play Next"));
    await settle();
  });
  expect(PlayerQueue.addTracksToPlaylist).toHaveBeenLastCalledWith(
    "playlist-1",
    [
      expect.objectContaining({
        id: "s1",
        url: "/documents/saved-offline/s1.flac",
      }),
    ],
  );

  await fireEvent.press(screen.getByLabelText("More actions for Teardrop"));
  await act(async () => {
    fireEvent.press(screen.getByText("Remove from Phone"));
    await settle();
  });
  expect(screen.queryByText("Teardrop")).toBeNull();
});
