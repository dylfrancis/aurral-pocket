jest.mock("@/lib/headless-session", () => ({ headlessSession: jest.fn() }));

jest.mock("@/lib/api/library", () => ({
  getArtistQueue: jest.fn(),
  getCanonicalArtist: jest.fn(),
  getCanonicalAlbum: jest.fn(),
  getCanonicalAlbumTracks: jest.fn(),
  getCanonicalArtistAlbums: jest.fn(),
  getCanonicalLibraryPage: jest.fn(),
}));

jest.mock("@/lib/api/search", () => ({
  getEditorialPlaylist: jest.fn(),
  getMadeForYou: jest.fn(),
  searchLibrary: jest.fn(),
}));

jest.mock("@/lib/api/flow", () => ({
  ...jest.requireActual("@/lib/api/flow"),
  getFlowStatus: jest.fn(),
  getPlaylistJobs: jest.fn(),
}));

jest.mock("@/hooks/flow/use-flow-status", () => ({
  flowStatusQueryOptions: () => ({
    queryKey: ["flow", "status"],
    queryFn: jest.requireMock("@/lib/api/flow").getFlowStatus,
  }),
}));

jest.mock("@/hooks/player/queue-covers", () => ({
  cachedAlbumCover: () => null,
}));

jest.mock("@/hooks/library/use-play-library-songs", () => ({
  ...jest.requireActual("@/hooks/library/use-play-library-songs"),
  readShuffleSongs: jest.fn(),
}));

jest.mock("@/hooks/player/use-start-queue", () => ({
  startQueue: jest.fn(async () => "started"),
}));

import { CAR_LISTS, loadCarList, searchCar } from "@/hooks/car/car-library";
import { readShuffleSongs } from "@/hooks/library/use-play-library-songs";
import { startQueue } from "@/hooks/player/use-start-queue";
import { ApiError, setAuthToken, setBaseUrl } from "@/lib/api/client";
import { getFlowStatus } from "@/lib/api/flow";
import {
  getArtistQueue,
  getCanonicalAlbum,
  getCanonicalAlbumTracks,
  getCanonicalArtist,
  getCanonicalArtistAlbums,
  getCanonicalLibraryPage,
} from "@/lib/api/library";
import { searchLibrary } from "@/lib/api/search";
import { headlessSession } from "@/lib/headless-session";
import { queryClient } from "@/lib/query-client";
import type {
  Album,
  Artist,
  CanonicalPage,
  LibraryQueueTrack,
  Track,
} from "@/lib/types/library";
import type { LibrarySearchTrack } from "@/lib/types/search";

const session = headlessSession as jest.Mock;

function album(overrides: Partial<Album> = {}): Album {
  return {
    id: "mb-kid-a",
    artistId: "3",
    artistName: "Radiohead",
    mbid: "mb-kid-a",
    foreignAlbumId: "mb-kid-a",
    albumName: "Kid A",
    title: "Kid A",
    releaseDate: "2000-10-02",
    monitored: true,
    statistics: { trackCount: 2, sizeOnDisk: 0, percentOfTracks: 100 },
    canonicalId: "12",
    coverUrl: "/library/covers/12",
    ...overrides,
  };
}

function track(id: string, overrides: Partial<Track> = {}): Track {
  return {
    id,
    mbid: `mb-${id}`,
    trackName: `Song ${id}`,
    title: `Song ${id}`,
    trackNumber: 1,
    discNumber: 1,
    hasFile: true,
    size: 1,
    quality: "FLAC",
    streamPath: `/library/stream/12/${id}`,
    ...overrides,
  };
}

function searchTrack(id: string): LibrarySearchTrack {
  return {
    id,
    title: `Song ${id}`,
    artistName: "Radiohead",
    albumTitle: `Album ${id}`,
    albumMbid: null,
    libraryAlbumId: `album-${id}`,
    trackMbid: null,
    artistMbid: null,
    releaseYear: null,
    durationMs: null,
    streamPath: `/library/stream/1/${id}`,
    coverUrl: null,
  };
}

function page(albums: Album[]): CanonicalPage {
  return {
    kind: "albums",
    page: 1,
    pageSize: 20,
    total: albums.length,
    hasMore: false,
    artists: [],
    albums,
    tracks: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  setBaseUrl("https://test.example");
  setAuthToken("t");
  session.mockResolvedValue({ userId: 1 });
});

describe("loadCarList", () => {
  it.each([
    ["no account is signed in", () => session.mockResolvedValue(null)],
    [
      "the server ended the session",
      () =>
        (getCanonicalLibraryPage as jest.Mock).mockRejectedValue(
          new ApiError(401, "Unauthorized"),
        ),
    ],
  ])("asks to sign in on the phone when %s", async (_, arrange) => {
    arrange();

    await expect(loadCarList(CAR_LISTS.albums)).resolves.toMatchObject({
      rows: [],
      signedOut: true,
      emptyTitle: "Sign in to Aurral on your phone",
    });
  });

  it("lists the most recently played albums, each opening by its Library id", async () => {
    (getCanonicalLibraryPage as jest.Mock).mockResolvedValue(
      page([album(), album({ canonicalId: undefined, title: "Unindexed" })]),
    );

    const list = await loadCarList(CAR_LISTS.recentlyPlayed);

    expect(getCanonicalLibraryPage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "albums",
        sort: "played",
        direction: "asc",
        pageSize: 20,
      }),
    );
    // The paged route reads an album only by its canonical id.
    expect(list.rows).toEqual([
      expect.objectContaining({
        id: "album:12",
        kind: "list",
        title: "Kid A",
        subtitle: "Radiohead",
      }),
    ]);
  });

  it("plays an album's songs in disc order as one queue, from the one picked", async () => {
    (getCanonicalAlbum as jest.Mock).mockResolvedValue(album());
    (getCanonicalAlbumTracks as jest.Mock).mockResolvedValue([
      track("2-1", { discNumber: 2 }),
      track("1-1"),
      track("missing", { trackNumber: 2, streamPath: null }),
    ]);

    const list = await loadCarList("album:12");
    await expect(list.play?.("2-1")).resolves.toBe(true);

    expect(list.rows.map(({ id, kind }) => [id, kind])).toEqual([
      ["1-1", "song"],
      ["2-1", "song"],
    ]);
    expect(startQueue).toHaveBeenCalledWith(
      queryClient,
      [
        expect.objectContaining({ id: "1-1", album: "Kid A" }),
        expect.objectContaining({ id: "2-1", album: "Kid A" }),
      ],
      expect.objectContaining({ albumTitle: "Kid A", albumRef: "12" }),
      { startId: "2-1" },
    );
  });

  it("shows no playlists, not an error, for an account without playlist access", async () => {
    (getFlowStatus as jest.Mock).mockRejectedValue(
      new ApiError(403, "Forbidden"),
    );

    await expect(loadCarList(CAR_LISTS.playlists)).resolves.toMatchObject({
      rows: [],
      emptyTitle: "No playlists",
    });
  });
});

describe("searchCar", () => {
  it("asks to sign in on the phone when the server ended the session", async () => {
    (searchLibrary as jest.Mock).mockRejectedValue(
      new ApiError(401, "Unauthorized"),
    );

    await expect(searchCar("song")).resolves.toMatchObject({
      rows: [],
      signedOut: true,
    });
  });

  it("plays a song it found alone, as Search does", async () => {
    (searchLibrary as jest.Mock).mockResolvedValue({
      query: "song",
      artists: [],
      albums: [],
      tracks: [searchTrack("a"), searchTrack("b")],
      playlists: [],
    });

    const list = await searchCar("song");
    await list.play?.("b");

    expect(startQueue).toHaveBeenCalledWith(
      queryClient,
      [expect.objectContaining({ id: "b", album: "Album b" })],
      expect.objectContaining({ albumTitle: "Album b", albumRef: "album-b" }),
      { startId: "b" },
    );
  });
});

describe("shuffle", () => {
  function artist(mbid: string): Artist {
    return {
      id: "3",
      mbid,
      foreignArtistId: mbid,
      artistName: "Radiohead",
      monitored: true,
      addedAt: null,
      statistics: {} as Artist["statistics"],
      canonicalId: "3",
    };
  }

  function queueTrack(id: string): LibraryQueueTrack {
    return {
      id,
      title: `Song ${id}`,
      artist: "Radiohead",
      album: "Kid A",
      streamPath: `/library/stream/12/${id}`,
      streamFormat: "flac",
      quality: "FLAC",
      durationMs: null,
      artistMbid: "mb-radiohead",
      albumMbid: null,
      trackMbid: null,
      libraryTrackId: Number(id),
      libraryAlbumId: 12,
      libraryArtistId: 3,
      artworkUrl: null,
      artworkSource: "album",
    };
  }

  it("shuffles a list of songs as one queue", async () => {
    (getCanonicalAlbum as jest.Mock).mockResolvedValue(album());
    (getCanonicalAlbumTracks as jest.Mock).mockResolvedValue([
      track("1"),
      track("2", { trackNumber: 2 }),
    ]);

    const list = await loadCarList("album:12");
    await expect(list.shuffle?.()).resolves.toBe(true);

    expect(startQueue).toHaveBeenCalledWith(
      queryClient,
      [
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "2" }),
      ],
      expect.objectContaining({ albumTitle: "Kid A" }),
      { shuffled: true },
    );
  });

  it("shuffles an artist's Library songs, as the artist page does", async () => {
    (getCanonicalArtistAlbums as jest.Mock).mockResolvedValue([album()]);
    (getCanonicalArtist as jest.Mock).mockResolvedValue(artist("mb-radiohead"));
    (getArtistQueue as jest.Mock).mockResolvedValue([queueTrack("7")]);

    const list = await loadCarList("artist:3");
    await list.shuffle?.();

    expect(getArtistQueue).toHaveBeenCalledWith("mb-radiohead");
    expect(startQueue).toHaveBeenCalledWith(
      queryClient,
      [expect.objectContaining({ id: "7" })],
      expect.objectContaining({ artistMbid: "mb-radiohead" }),
      { shuffled: true },
    );
  });

  it("offers no Shuffle for an artist without an MBID, since the queue is read by one", async () => {
    (getCanonicalArtistAlbums as jest.Mock).mockResolvedValue([album()]);
    (getCanonicalArtist as jest.Mock).mockResolvedValue(artist(""));

    const list = await loadCarList("artist:4");

    expect(list.shuffle).toBeUndefined();
  });

  it("shuffles the Library as Library home's Shuffle Library does", async () => {
    (readShuffleSongs as jest.Mock).mockResolvedValue([track("9")]);

    const list = await loadCarList(CAR_LISTS.library);
    await list.shuffle?.();

    expect(readShuffleSongs).toHaveBeenCalledWith({});
    expect(startQueue).toHaveBeenCalledWith(
      queryClient,
      [expect.objectContaining({ id: "9" })],
      expect.objectContaining({ albumTitle: "Library" }),
      { shuffled: true },
    );
  });
});
