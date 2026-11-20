jest.mock("@/lib/headless-session", () => ({ headlessSession: jest.fn() }));

jest.mock("@/lib/offline/saved-library", () => ({
  savedStatuses: jest.fn(),
  canPlayNow: jest.fn(() => true),
}));

jest.mock("@/lib/offline/network", () => ({
  isOffline: jest.fn(() => false),
  networkKnown: jest.fn(async () => {}),
}));

jest.mock("@/lib/api/search", () => ({ searchLibrary: jest.fn() }));

jest.mock("@/lib/api/library", () => ({
  getArtistQueue: jest.fn(),
  getCanonicalAlbumTracks: jest.fn(),
  getCanonicalGenres: jest.fn(),
  getCanonicalLibraryPage: jest.fn(),
}));

jest.mock("@/lib/api/flow", () => ({
  getFlowStatus: jest.fn(),
  getPlaylistJobs: jest.fn(),
}));

jest.mock("@/hooks/flow/use-flow-status", () => ({
  flowStatusQueryOptions: () => ({
    queryKey: ["flow", "status"],
    queryFn: jest.requireMock("@/lib/api/flow").getFlowStatus,
  }),
}));

jest.mock("@/hooks/library/use-play-library-songs", () => ({
  ...jest.requireActual("@/hooks/library/use-play-library-songs"),
  readShuffleSongs: jest.fn(),
}));

jest.mock("@/hooks/player/queue-covers", () => ({
  cachedAlbumCover: () => null,
  fillQueueCovers: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/player/player", () => ({
  hasQueue: jest.fn(() => false),
  isPlaybackActive: jest.fn(() => false),
  playAlbumFromTrack: jest.fn(async () => true),
  playQueueFrom: jest.fn(async () => true),
  restoreSavedQueue: jest.fn(async () => false),
  setShuffle: jest.fn(async () => {}),
  startRadio: jest.fn(async () => "started"),
  togglePlayback: jest.fn(async () => {}),
}));

import { findForSiri, playForSiri } from "@/hooks/siri/answer-siri";
import { readShuffleSongs } from "@/hooks/library/use-play-library-songs";
import { ApiError, setAuthToken, setBaseUrl } from "@/lib/api/client";
import { getFlowStatus } from "@/lib/api/flow";
import {
  getArtistQueue,
  getCanonicalAlbumTracks,
  getCanonicalGenres,
  getCanonicalLibraryPage,
} from "@/lib/api/library";
import { searchLibrary } from "@/lib/api/search";
import { isOffline } from "@/lib/offline/network";
import { savedStatuses, type SaveStatus } from "@/lib/offline/saved-library";
import {
  hasQueue,
  playAlbumFromTrack,
  playQueueFrom,
  setShuffle,
  startRadio,
  togglePlayback,
} from "@/lib/player/player";
import { queryClient } from "@/lib/query-client";
import { headlessSession } from "@/lib/headless-session";
import type { AlbumTrack, Track } from "@/lib/types/library";
import type {
  LibrarySearchAlbum,
  LibrarySearchArtist,
} from "@/lib/types/search";
import type { SiriFindAnswer, SiriSearch } from "@/modules/siri";

const mockSearchLibrary = searchLibrary as jest.Mock;
const mockSavedStatuses = savedStatuses as jest.Mock;
const mockIsOffline = isOffline as jest.Mock;

function heard(overrides: Partial<SiriSearch> = {}): SiriSearch {
  return {
    mediaType: "unknown",
    genres: [],
    mine: false,
    suggested: [],
    ...overrides,
  };
}

function track(id: string, trackNumber: number, discNumber = 1): Track {
  return {
    id,
    mbid: `mb-${id}`,
    trackName: `Track ${id}`,
    title: `Track ${id}`,
    trackNumber,
    discNumber,
    hasFile: true,
    size: 1,
    quality: null,
    streamPath: `/library/canonical-stream/1/${id}`,
    artistName: "Radiohead",
  };
}

const KID_A_TRACKS = [track("1", 1), track("2", 2)];

function savedKidA(): SaveStatus {
  return {
    item: {
      kind: "album",
      id: "lib-kid-a",
      userId: 1,
      savedAt: 1,
      route: {
        title: "Kid A",
        artistName: "Radiohead",
        artistMbid: "artist-mb",
        albumMbid: "album-mb",
        coverUrl: "",
        libraryAlbumId: "lib-kid-a",
        artistId: "artist-1",
      },
      tracks: KID_A_TRACKS,
    },
    state: "saved",
    total: 2,
    saved: 2,
    failed: 0,
    bytes: 2,
  };
}

const LIBRARY_KID_A: LibrarySearchAlbum = {
  id: "album-mb",
  libraryId: "lib-kid-a",
  title: "Kid A",
  artistName: "Radiohead",
  artistMbid: "artist-mb",
  releaseDate: null,
  coverUrl: null,
};

const RADIOHEAD: LibrarySearchArtist = {
  id: "artist-mb",
  libraryId: "lib-radiohead",
  hasMbid: true,
  name: "Radiohead",
  image: null,
};

function searchFinds(
  albums: LibrarySearchAlbum[],
  artists: LibrarySearchArtist[] = [],
) {
  mockSearchLibrary.mockResolvedValue({
    query: "",
    artists,
    albums,
    tracks: [],
    playlists: [],
  });
}

function itemIdOf(answer: SiriFindAnswer): string {
  if (answer.status !== "found") throw new Error(`found ${answer.status}`);
  return answer.item.id;
}

beforeEach(() => {
  jest.clearAllMocks();
  setBaseUrl("https://aurral.test");
  setAuthToken("token");
  (headlessSession as jest.Mock).mockResolvedValue({ userId: 1 });
  mockSavedStatuses.mockResolvedValue([]);
  mockIsOffline.mockReturnValue(false);
  searchFinds([]);
  (getCanonicalGenres as jest.Mock).mockResolvedValue([]);
  (getFlowStatus as jest.Mock).mockResolvedValue({
    staticPlaylists: [],
    flows: [],
  });
});

afterEach(() => queryClient.clear());

describe("findForSiri", () => {
  it("plays a saved album that matches every word, without asking the server", async () => {
    mockSavedStatuses.mockResolvedValue([savedKidA()]);

    const answer = await findForSiri(heard({ name: "Kid A by Radiohead" }));

    expect(answer).toMatchObject({
      status: "found",
      item: { title: "Kid A", type: "album", artist: "Radiohead" },
    });
    expect(mockSearchLibrary).not.toHaveBeenCalled();
    await expect(playForSiri({ itemId: itemIdOf(answer) })).resolves.toEqual({
      status: "playing",
    });
    expect(playAlbumFromTrack).toHaveBeenCalledWith(
      KID_A_TRACKS,
      KID_A_TRACKS[0],
      expect.objectContaining({ albumTitle: "Kid A", albumRef: "lib-kid-a" }),
    );
  });

  it("plays a Library album in disc order", async () => {
    searchFinds([LIBRARY_KID_A]);
    const discTwo = track("3", 1, 2);
    const discOne = track("4", 1, 1);
    (getCanonicalAlbumTracks as jest.Mock).mockResolvedValue([
      discTwo,
      discOne,
    ]);

    const answer = await findForSiri(heard({ name: "Kid A" }));
    await playForSiri({ itemId: itemIdOf(answer) });

    expect(getCanonicalAlbumTracks).toHaveBeenCalledWith("lib-kid-a");
    expect(playAlbumFromTrack).toHaveBeenCalledWith(
      [discOne, discTwo],
      discOne,
      expect.objectContaining({ albumTitle: "Kid A" }),
    );
  });

  it("plays a genre's Library songs shuffled", async () => {
    (getCanonicalGenres as jest.Mock).mockResolvedValue([
      { name: "Rock", artists: 1, albums: 1, tracks: 2 },
    ]);
    const songs: AlbumTrack[] = [track("5", 1), track("6", 2)];
    (readShuffleSongs as jest.Mock).mockResolvedValue(songs);

    const answer = await findForSiri(heard({ genres: ["rock"] }));
    await playForSiri({ itemId: itemIdOf(answer) });

    expect(readShuffleSongs).toHaveBeenCalledWith({ genre: "Rock" });
    expect(setShuffle).toHaveBeenCalledWith(true);
    expect(playQueueFrom).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "5" }),
        expect.objectContaining({ id: "6" }),
      ]),
      expect.any(String),
      expect.objectContaining({ albumTitle: "Rock" }),
    );
  });

  it("starts an artist's radio, as the artist page's Radio does", async () => {
    searchFinds([], [RADIOHEAD]);

    const answer = await findForSiri(heard({ name: "Radiohead radio" }));
    expect(answer).toMatchObject({
      status: "found",
      item: { title: "Radiohead Radio", type: "station" },
    });
    await playForSiri({ itemId: itemIdOf(answer) });

    expect(startRadio).toHaveBeenCalledWith(
      {
        seed: { artists: [{ id: "lib-radiohead", mbid: "artist-mb" }] },
        label: "Radiohead",
      },
      null,
    );
  });

  // Radio needs a connection, and can find nothing similar in the Library.
  it.each(["offline", "empty"])(
    "plays the artist when the radio comes back %s",
    async (result) => {
      searchFinds([], [RADIOHEAD]);
      (startRadio as jest.Mock).mockResolvedValueOnce(result);
      (getArtistQueue as jest.Mock).mockResolvedValue([
        {
          id: "7",
          title: "Airbag",
          artist: "Radiohead",
          album: "OK Computer",
          streamPath: "/library/canonical-stream/1/7",
          streamFormat: null,
          quality: null,
          durationMs: null,
          artistMbid: "artist-mb",
          albumMbid: null,
          trackMbid: null,
          libraryTrackId: 7,
        },
      ]);

      const answer = await findForSiri(heard({ name: "Radiohead radio" }));
      await expect(playForSiri({ itemId: itemIdOf(answer) })).resolves.toEqual({
        status: "playing",
      });

      expect(getArtistQueue).toHaveBeenCalledWith("artist-mb");
      expect(playQueueFrom).toHaveBeenCalled();
    },
  );

  it("starts Your Radio from the last plays when radio is all Siri heard", async () => {
    (getCanonicalLibraryPage as jest.Mock).mockResolvedValue({
      tracks: [{ id: "9" }, { id: "8" }],
    });

    const answer = await findForSiri(heard({ name: "radio" }));
    await playForSiri({ itemId: itemIdOf(answer) });

    expect(startRadio).toHaveBeenCalledWith(
      { seed: { trackIds: ["9", "8"] }, label: "Your" },
      null,
    );
  });

  it("resumes the queue when nothing is named", async () => {
    (hasQueue as jest.Mock).mockReturnValue(true);

    const answer = await findForSiri(heard({ mediaType: "music" }));
    await playForSiri({ itemId: itemIdOf(answer) });

    expect(togglePlayback).toHaveBeenCalled();
  });

  it.each<[string, () => void, Partial<SiriSearch>, SiriFindAnswer]>([
    [
      "no one is signed in",
      () => (headlessSession as jest.Mock).mockResolvedValue(null),
      { name: "Kid A" },
      { status: "signedOut" },
    ],
    [
      "the phone is offline and nothing saved matches",
      () => mockIsOffline.mockReturnValue(true),
      { name: "Kid A" },
      { status: "unavailable" },
    ],
    [
      "the server can't be reached",
      () => {
        const unreachable = new ApiError(0, "Network");
        mockSearchLibrary.mockRejectedValue(unreachable);
        (getCanonicalGenres as jest.Mock).mockRejectedValue(unreachable);
        (getFlowStatus as jest.Mock).mockRejectedValue(unreachable);
      },
      { name: "Kid A" },
      { status: "unavailable" },
    ],
    [
      "the server refuses the session",
      () =>
        mockSearchLibrary.mockRejectedValue(new ApiError(401, "Unauthorized")),
      { name: "Kid A" },
      { status: "signedOut" },
    ],
    [
      "the Library has no match",
      () => {},
      { name: "Kid A" },
      { status: "notFound" },
    ],
    // An account without playlist access has none, and Aurral is up.
    [
      "the account can't see playlists",
      () =>
        (getFlowStatus as jest.Mock).mockRejectedValue(
          new ApiError(403, "Forbidden"),
        ),
      { mediaType: "playlist", name: "Workout" },
      { status: "notFound" },
    ],
    [
      "Siri asks for a podcast",
      () => {},
      { mediaType: "other", name: "Serial" },
      { status: "unsupportedType" },
    ],
  ])("answers when %s", async (_, arrange, search, expected) => {
    arrange();

    await expect(findForSiri(heard(search))).resolves.toEqual(expected);
  });
});

describe("playForSiri", () => {
  // Siri keeps the items it played, and offers them again after a restart.
  it("finds an item from an earlier run again by its title", async () => {
    mockSavedStatuses.mockResolvedValue([savedKidA()]);

    await expect(
      playForSiri({
        itemId: "aurral:earlier-run:1",
        title: "Kid A",
        artist: "Radiohead",
        itemType: "album",
      }),
    ).resolves.toEqual({ status: "playing" });

    expect(playAlbumFromTrack).toHaveBeenCalledWith(
      KID_A_TRACKS,
      KID_A_TRACKS[0],
      expect.objectContaining({ albumTitle: "Kid A" }),
    );
  });

  it("plays another account's item only if this account has it too", async () => {
    mockSavedStatuses.mockResolvedValue([savedKidA()]);
    const answer = await findForSiri(heard({ name: "Kid A" }));
    (headlessSession as jest.Mock).mockResolvedValue({ userId: 2 });
    mockSavedStatuses.mockResolvedValue([]);

    await expect(
      playForSiri({ itemId: itemIdOf(answer), title: "Kid A" }),
    ).resolves.toEqual({ status: "failed" });
    expect(playAlbumFromTrack).not.toHaveBeenCalled();
  });

  it("fails for an item it never found and can't look up", async () => {
    await expect(playForSiri({ itemId: "aurral:unknown" })).resolves.toEqual({
      status: "failed",
    });
  });
});
