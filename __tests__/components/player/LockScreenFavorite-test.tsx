jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  getCanonicalAlbumTracks: jest.fn(),
  getLibraryFavorites: jest.fn(),
  updateLibraryFavorites: jest.fn(),
}));

// The facade's engine side is player-lock-screen-test's; here it records what
// the star was told to show, and hands the tests the tap listener.
let mockTrack: PlayerTrack | null = null;
const mockSetStar = jest.fn();
let mockTapStar: ((press: FavoriteStar) => void) | null = null;
jest.mock("@/lib/player/player", () => ({
  useCurrentTrack: () => mockTrack,
  setLockScreenFavorite: (star: FavoriteStar | null) => mockSetStar(star),
  onLockScreenFavoritePress: (listener: (press: FavoriteStar) => void) => {
    mockTapStar = listener;
    return () => {
      mockTapStar = null;
    };
  },
}));

import React from "react";
import { act, render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LockScreenFavorite } from "@/components/player/LockScreenFavorite";
import {
  getCanonicalAlbumTracks,
  getLibraryFavorites,
  updateLibraryFavorites,
} from "@/lib/api/library";
import type { FavoriteStar } from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";
import type { LibraryFavorites } from "@/lib/types/library";

const mockAlbumTracks = getCanonicalAlbumTracks as jest.Mock;
const mockFavorites = getLibraryFavorites as jest.Mock;
const mockUpdateFavorites = updateLibraryFavorites as jest.Mock;

const SONG: PlayerTrack = {
  id: "77",
  title: "Karma Police",
  artist: "Radiohead",
  album: "OK Computer",
  duration: 0,
  url: "http://server/api/library/stream/12/77?token=token",
  artwork: null,
  streamPath: "/library/stream/12/77",
  coverPath: null,
  trackMbid: null,
  artistMbid: null,
  albumMbid: null,
  favorite: { kind: "song", key: "karma-police" },
};

/** A radio track, sent without its favorite. */
const RADIO_TRACK: PlayerTrack = {
  ...SONG,
  id: "78",
  title: "Exit Music",
  url: "http://server/api/library/stream/12/78?token=token",
  streamPath: "/library/stream/12/78",
  favorite: null,
};

/** A preview clip, which has no favorite. */
const CLIP: PlayerTrack = {
  ...SONG,
  id: "preview-9",
  url: "https://preview.example/9.mp3",
  streamPath: null,
  favorite: null,
};

function favorites(identityKeys: string[]): LibraryFavorites {
  return {
    artists: [],
    albums: [],
    tracks: identityKeys.map((identityKey) => ({ identityKey }) as never),
    playlistSongIds: [],
  };
}

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  mockTrack = SONG;
  mockSetStar.mockClear();
  mockFavorites.mockReset().mockResolvedValue(favorites([]));
  mockUpdateFavorites.mockReset().mockResolvedValue({ changedIds: [] });
});

afterEach(() => client.clear());

async function renderStar() {
  const view = await render(
    <QueryClientProvider client={client}>
      <LockScreenFavorite />
    </QueryClientProvider>,
  );
  return {
    ...view,
    rerender: () =>
      view.rerender(
        <QueryClientProvider client={client}>
          <LockScreenFavorite />
        </QueryClientProvider>,
      ),
  };
}

async function tapStar(press: FavoriteStar) {
  await act(async () => mockTapStar!(press));
}

it("fills the star for a favorite song and hides it for a clip", async () => {
  mockFavorites.mockResolvedValue(favorites(["karma-police"]));
  const { rerender } = await renderStar();
  expect(mockSetStar).toHaveBeenLastCalledWith({
    trackId: "77",
    isFavorite: true,
  });

  mockTrack = CLIP;
  await rerender();
  expect(mockSetStar).toHaveBeenLastCalledWith(null);
});

it("keeps the star up while a radio track's favorite is read from its album", async () => {
  let answerAlbum: (tracks: unknown[]) => void = () => {};
  mockAlbumTracks.mockReturnValue(
    new Promise((resolve) => {
      answerAlbum = resolve;
    }),
  );
  mockFavorites.mockResolvedValue(favorites(["exit-music"]));
  const { rerender } = await renderStar();
  mockSetStar.mockClear();

  mockTrack = RADIO_TRACK;
  await rerender();
  expect(mockSetStar).not.toHaveBeenCalled();

  await act(async () => answerAlbum([{ id: "78", identityKey: "exit-music" }]));
  expect(mockSetStar.mock.calls).toEqual([
    [{ trackId: "78", isFavorite: true }],
  ]);
});

it("adds the song to favorites when the star is filled", async () => {
  await renderStar();
  mockSetStar.mockClear();
  mockFavorites.mockResolvedValue(favorites(["karma-police"]));

  await tapStar({ trackId: "77", isFavorite: true });

  expect(mockUpdateFavorites).toHaveBeenCalledWith(["song:karma-police"], true);
  // Filled from the tap through the reread, with no flicker back.
  expect(mockSetStar.mock.calls).toEqual([
    [{ trackId: "77", isFavorite: true }],
  ]);
});

it("puts the star back when Aurral refuses the change", async () => {
  await renderStar();
  mockSetStar.mockClear();
  mockUpdateFavorites.mockRejectedValue(new Error("refused"));

  await tapStar({ trackId: "77", isFavorite: true });

  expect(mockSetStar).toHaveBeenLastCalledWith({
    trackId: "77",
    isFavorite: false,
  });
});

it("puts the star back for a tap before the favorites have loaded", async () => {
  mockFavorites.mockReturnValue(new Promise(() => {}));
  await renderStar();
  mockSetStar.mockClear();

  await tapStar({ trackId: "77", isFavorite: true });

  expect(mockUpdateFavorites).not.toHaveBeenCalled();
  expect(mockSetStar.mock.calls).toEqual([
    [{ trackId: "77", isFavorite: false }],
  ]);
});

it("puts the star back for a tap on a track the player has left", async () => {
  mockFavorites.mockResolvedValue(favorites(["karma-police"]));
  await renderStar();
  mockSetStar.mockClear();

  await tapStar({ trackId: "76", isFavorite: true });

  expect(mockUpdateFavorites).not.toHaveBeenCalled();
  expect(mockSetStar.mock.calls).toEqual([
    [{ trackId: "76", isFavorite: false }],
  ]);
});
