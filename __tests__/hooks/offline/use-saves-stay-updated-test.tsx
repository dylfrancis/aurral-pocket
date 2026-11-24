jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ token: "token" }),
}));
jest.mock("@/lib/offline/network", () => ({
  isOffline: () => false,
  useIsOffline: () => false,
}));
jest.mock("@/lib/api/library", () => ({
  ...jest.requireActual("@/lib/api/library"),
  getCanonicalLibraryPage: jest.fn(),
}));
jest.mock("@/lib/api/flow", () => ({
  ...jest.requireActual("@/lib/api/flow"),
  getPlaylistJobs: jest.fn(),
}));

let mockFavoritesSave: string | null = null;
let mockKeptPlaylistIds: string[] = [];
const mockApplyFavorites = jest.fn((_input: unknown) => Promise.resolve());
const mockRefreshSavedPlaylist = jest.fn((_input: unknown) =>
  Promise.resolve(),
);
jest.mock("@/lib/offline/saved-library", () => ({
  useFavoritesSave: () => mockFavoritesSave,
  useKeptPlaylistIds: () => mockKeptPlaylistIds,
  applyFavorites: (input: unknown) => mockApplyFavorites(input),
  refreshSavedPlaylist: (input: unknown) => mockRefreshSavedPlaylist(input),
}));

import React from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { useSavesStayUpdated } from "@/hooks/offline/use-saves-stay-updated";
import { getPlaylistJobs } from "@/lib/api/flow";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { FlowJob } from "@/lib/types/flow";
import type { CanonicalPage, Track } from "@/lib/types/library";

const mockGetPage = getCanonicalLibraryPage as jest.Mock;
const mockGetPlaylistJobs = getPlaylistJobs as jest.Mock;

function song(id: string): Track {
  return {
    id,
    mbid: `mb-${id}`,
    trackName: `Track ${id}`,
    title: `Track ${id}`,
    trackNumber: 1,
    hasFile: true,
    size: 1_000,
    quality: "FLAC",
    streamPath: `/library/stream/4/${id}`,
    streamFormat: "flac",
  };
}

/**
 * Serves `tracks` as the favorite songs, and no favorite artists or albums,
 * once `ready` settles.
 */
function serveFavorites(
  tracks: Track[],
  ready: Promise<void> = Promise.resolve(),
) {
  mockGetPage.mockImplementation(
    async ({ kind }: { kind: string }): Promise<CanonicalPage> =>
      ready.then(() => ({
        kind,
        page: 1,
        pageSize: 100,
        total: kind === "tracks" ? tracks.length : 0,
        hasMore: false,
        artists: [],
        albums: [],
        tracks: kind === "tracks" ? tracks : [],
      })) as unknown as Promise<CanonicalPage>,
  );
}

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Lets reads, effects and the store's promises land. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFavoritesSave = null;
  mockKeptPlaylistIds = [];
  client = new QueryClient({
    defaultOptions: {
      // No gc timers, which would keep a lone run of this file from exiting.
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
});

afterEach(() => client.clear());

describe("useSavesStayUpdated", () => {
  it("reads nothing while Favorites saves nothing and no playlist keeps updated", async () => {
    await renderHook(() => useSavesStayUpdated(), { wrapper });
    await settle();

    expect(mockGetPage).not.toHaveBeenCalled();
    expect(mockApplyFavorites).not.toHaveBeenCalled();
  });

  it("hands Favorites the full read of favorite songs", async () => {
    mockFavoritesSave = "songs";
    serveFavorites([song("1"), song("2")]);

    await renderHook(() => useSavesStayUpdated(), { wrapper });
    await settle();

    expect(mockApplyFavorites).toHaveBeenCalledWith({
      // The queue's copy to save, and the row Favorites lists offline.
      songs: ["1", "2"].map((id) => ({
        track: expect.objectContaining({
          id,
          streamPath: `/library/stream/4/${id}`,
        }),
        row: expect.objectContaining({ id, trackName: `Track ${id}` }),
      })),
      albums: [],
    });
  });

  it("waits for a heart on its way, so a guessed removal deletes no file", async () => {
    mockFavoritesSave = "songs";
    let finishRead = () => {};
    const read = new Promise<void>((resolve) => {
      finishRead = resolve;
    });
    serveFavorites([song("1")], read);
    let finishToggle = () => {};
    const { result } = await renderHook(
      () => {
        useSavesStayUpdated();
        return useMutation({
          mutationKey: libraryKeys.favorites(),
          mutationFn: () =>
            new Promise<void>((resolve) => {
              finishToggle = resolve;
            }),
        });
      },
      { wrapper },
    );
    await act(async () => result.current.mutate());

    await act(async () => finishRead());
    await settle();
    expect(mockApplyFavorites).not.toHaveBeenCalled();

    await act(async () => finishToggle());
    await settle();
    expect(mockApplyFavorites).toHaveBeenCalledTimes(1);
  });

  it("brings each Keep Updated playlist in line with its read", async () => {
    mockKeptPlaylistIds = ["pl-1"];
    const jobs = [{ id: "a", status: "done" }] as FlowJob[];
    mockGetPlaylistJobs.mockResolvedValue(jobs);

    await renderHook(() => useSavesStayUpdated(), { wrapper });
    await settle();

    expect(mockGetPlaylistJobs).toHaveBeenCalledWith("pl-1");
    expect(mockRefreshSavedPlaylist).toHaveBeenCalledWith({
      id: "pl-1",
      jobs,
      playlist: undefined,
    });
  });
});
