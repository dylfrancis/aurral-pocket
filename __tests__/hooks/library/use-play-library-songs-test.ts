jest.mock("@/lib/api/library", () => ({
  getCanonicalLibraryPage: jest.fn(),
}));

import { getCanonicalLibraryPage } from "@/lib/api/library";
import { readShuffleSongs } from "@/hooks/library/use-play-library-songs";
import type { CanonicalPage, Track } from "@/lib/types/library";

const mockGetPage = getCanonicalLibraryPage as jest.Mock;

function pageOf(page: number, total: number): CanonicalPage {
  return {
    kind: "tracks",
    page,
    pageSize: 100,
    total,
    hasMore: page * 100 < total,
    artists: [],
    albums: [],
    tracks: [{ id: `song-${page}` } as Track],
  };
}

const pagesRead = () =>
  mockGetPage.mock.calls.map(([params]) => params.page as number);

beforeEach(() => {
  mockGetPage.mockReset();
});

describe("readShuffleSongs", () => {
  it("reads five pages drawn from across a large Library, each once", async () => {
    mockGetPage.mockImplementation(async ({ page }) => pageOf(page, 14_497));

    const songs = await readShuffleSongs({});

    // Page 1 tells how many pages there are; five are drawn from all 145, and
    // page 1 is reused if it's one of them.
    const [first, ...drawn] = pagesRead();
    expect(first).toBe(1);
    expect(new Set(drawn).size).toBe(drawn.length);
    expect(drawn.every((page) => page > 1 && page <= 145)).toBe(true);
    expect(songs).toHaveLength(5);
  });

  it("reads every page of a small Library", async () => {
    mockGetPage.mockImplementation(async ({ page }) => pageOf(page, 250));

    const songs = await readShuffleSongs({ genre: "Rock" });

    expect(songs.map((song) => song.id).sort()).toEqual([
      "song-1",
      "song-2",
      "song-3",
    ]);
    expect(mockGetPage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "tracks", genre: "Rock" }),
    );
  });
});
