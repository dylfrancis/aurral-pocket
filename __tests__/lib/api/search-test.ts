jest.mock("@/lib/api/client", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { api } from "@/lib/api/client";
import {
  addEditorialPlaylistToLibrary,
  getEditorialLinks,
  getEditorialPlaylist,
  getEditorialShelf,
  getMadeForYou,
  searchArtists,
  searchCatalog,
  searchLibrary,
  searchLibraryTracks,
  resolveStreamingLink,
  addArtist,
  getSimilarArtists,
  getDiscovery,
  getRecentlyAdded,
  getRecentReleases,
  getReleaseFeed,
  getNearbyShows,
} from "@/lib/api/search";

const mockApi = api as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("searchArtists", () => {
  it("calls the contract's GET /search with scope=artist", async () => {
    mockApi.get.mockResolvedValue({
      data: {
        scope: "artist",
        query: "radiohead",
        count: 1,
        offset: 0,
        items: [
          {
            type: "artist",
            id: "mbid-1",
            name: "Radiohead",
            image: null,
            tags: ["rock"],
            inLibrary: false,
            score: 0,
          },
        ],
      },
    });

    const result = await searchArtists("radiohead");

    expect(mockApi.get).toHaveBeenCalledWith("/search", {
      params: { q: "radiohead", scope: "artist", limit: 24 },
    });
    expect(result).toEqual({
      artists: [{ id: "mbid-1", name: "Radiohead", disambiguation: null }],
    });
  });

  it("keeps the disambiguation that tells same-named artists apart", async () => {
    mockApi.get.mockResolvedValue({
      data: {
        count: 2,
        offset: 0,
        items: [
          { id: "nv-us", name: "Nirvana", disambiguation: "US grunge band" },
          { id: "nv-uk", name: "Nirvana", disambiguation: "60s UK band" },
        ],
      },
    });

    const { artists } = await searchArtists("nirvana");

    expect(artists.map((artist) => artist.disambiguation)).toEqual([
      "US grunge band",
      "60s UK band",
    ]);
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("Network error"));
    await expect(searchArtists("test")).rejects.toThrow("Network error");
  });
});

describe("searchLibraryTracks", () => {
  it("asks GET /search/library for the query and returns its tracks", async () => {
    const track = { id: "9", title: "Blinding Lights", streamPath: "/s" };
    mockApi.get.mockResolvedValue({
      data: {
        query: "Blinding Lights",
        artists: [],
        albums: [],
        tracks: [track],
      },
    });

    await expect(searchLibraryTracks("Blinding Lights")).resolves.toEqual([
      track,
    ]);
    expect(mockApi.get).toHaveBeenCalledWith("/search/library", {
      params: { q: "Blinding Lights", limit: 30 },
    });
  });
});

describe("searchLibrary", () => {
  it("asks GET /search/library for the query and returns every kind it matched", async () => {
    const artist = { id: "a1", libraryId: "1", name: "Karma Band" };
    const album = { id: "rg1", libraryId: "2", title: "Karma" };
    const track = { id: "77", title: "Karma Police", streamPath: "/s" };
    const playlist = { id: "f1", name: "Karma Mix", sourceFlowId: "f1" };
    mockApi.get.mockResolvedValue({
      data: {
        query: "karma",
        artists: [artist],
        albums: [album],
        tracks: [track],
        playlists: [playlist],
      },
    });

    await expect(searchLibrary("karma")).resolves.toEqual({
      query: "karma",
      artists: [artist],
      albums: [album],
      tracks: [track],
      playlists: [playlist],
    });
    expect(mockApi.get).toHaveBeenCalledWith("/search/library", {
      params: { q: "karma", limit: 30 },
    });
  });
});

describe("resolveStreamingLink", () => {
  it("passes the link to GET /search/link as url", async () => {
    const link =
      "https://music.apple.com/us/album/after-hours/1499378108?i=1499378615";
    mockApi.get.mockResolvedValue({ data: { kind: "track" } });

    await resolveStreamingLink(link);

    expect(mockApi.get).toHaveBeenCalledWith("/search/link", {
      params: { url: link },
    });
  });
});

describe("searchCatalog", () => {
  it("reads catalog artists, albums, songs and the outage status from GET /search/unified", async () => {
    mockApi.get.mockResolvedValue({
      data: {
        query: "abbey road",
        status: "unavailable",
        top: null,
        artists: [{ id: "a-1", name: "The Beatles", inLibrary: true }],
        albums: [
          {
            id: "rg-1",
            title: "Abbey Road",
            artistName: "The Beatles",
            artistMbid: "a-1",
            releaseDate: "1969-09-26",
            primaryType: "Album",
            secondaryTypes: [],
            coverUrl: null,
          },
          // A Library album with no MBID has no release page to open.
          { id: null, title: "Rips", artistName: "Unknown", artistMbid: null },
        ],
        tracks: [
          {
            type: "track",
            source: "metadata",
            id: "rec-1",
            key: "rec-1",
            title: "Come Together",
            artistName: "The Beatles",
            albumTitle: "Abbey Road",
            albumMbid: "rg-1",
            artistMbid: "a-1",
            coverUrl: "https://coverartarchive.org/release/r-1/front.jpg",
            streamPath: null,
            inLibrary: false,
          },
        ],
      },
    });

    const result = await searchCatalog("abbey road");

    expect(mockApi.get).toHaveBeenCalledWith("/search/unified", {
      params: { q: "abbey road", limit: 30 },
    });
    expect(result).toEqual({
      status: "unavailable",
      artists: [{ id: "a-1", name: "The Beatles", disambiguation: null }],
      albums: [
        {
          type: "album",
          id: "rg-1",
          title: "Abbey Road",
          artistName: "The Beatles",
          artistMbid: "a-1",
          releaseDate: "1969-09-26",
          primaryType: "Album",
          secondaryTypes: [],
          coverUrl: null,
        },
      ],
      songs: [
        {
          id: "rec-1",
          title: "Come Together",
          artistName: "The Beatles",
          albumTitle: "Abbey Road",
          albumMbid: "rg-1",
          artistMbid: "a-1",
          coverUrl: "https://coverartarchive.org/release/r-1/front.jpg",
          inLibrary: false,
        },
      ],
    });
  });
});

describe("addArtist", () => {
  it("calls POST /library/artists with request body", async () => {
    const response = {
      queued: true,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
    };
    mockApi.post.mockResolvedValue({ data: response });

    const result = await addArtist({
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      monitoring: { monitored: true, useDefault: true },
    });
    expect(mockApi.post).toHaveBeenCalledWith("/library/artists", {
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      monitoring: { monitored: true, useDefault: true },
    });
    expect(result).toEqual(response);
  });

  it("propagates errors", async () => {
    mockApi.post.mockRejectedValue(new Error("Conflict"));
    await expect(
      addArtist({
        foreignArtistId: "abc",
        artistName: "Test",
        monitoring: { monitored: false },
      }),
    ).rejects.toThrow("Conflict");
  });
});

describe("getSimilarArtists", () => {
  it("calls GET /artists/:mbid/similar and unwraps artists array", async () => {
    const similar = [
      { id: "2", name: "Atoms for Peace", image: null, match: 80 },
    ];
    mockApi.get.mockResolvedValue({ data: { artists: similar } });

    const result = await getSimilarArtists("abc-123");
    expect(mockApi.get).toHaveBeenCalledWith("/artists/abc-123/similar", {
      params: { limit: 10 },
    });
    expect(result).toEqual(similar);
  });

  it("passes custom limit", async () => {
    mockApi.get.mockResolvedValue({ data: { artists: [] } });

    await getSimilarArtists("abc-123", 5);
    expect(mockApi.get).toHaveBeenCalledWith("/artists/abc-123/similar", {
      params: { limit: 5 },
    });
  });
});

describe("getDiscovery", () => {
  const emptyResponse = {
    recommendations: [],
    globalTop: [],
    basedOn: [],
    topTags: [],
    topGenres: [],
    lastUpdated: null,
    configured: true,
  };

  it("calls GET /discover without params", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    const result = await getDiscovery();
    expect(mockApi.get).toHaveBeenCalledWith("/discover");
    expect(result).toEqual(emptyResponse);
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("500"));
    await expect(getDiscovery()).rejects.toThrow("500");
  });
});

describe("getRecentlyAdded", () => {
  it("calls GET /library/recent and returns the array", async () => {
    const response = [
      {
        id: "1",
        mbid: "mbid-1",
        foreignArtistId: "mbid-1",
        artistName: "Radiohead",
        addedAt: "2026-04-01T00:00:00Z",
      },
    ];
    mockApi.get.mockResolvedValue({ data: response });

    const result = await getRecentlyAdded();
    expect(mockApi.get).toHaveBeenCalledWith("/library/recent");
    expect(result).toEqual(response);
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("401"));
    await expect(getRecentlyAdded()).rejects.toThrow("401");
  });
});

describe("getRecentReleases", () => {
  it("calls GET /library/recent-releases and returns the array", async () => {
    const response = [
      {
        id: "1",
        mbid: "album-mbid",
        albumName: "In Rainbows",
        artistName: "Radiohead",
        releaseDate: "2007-10-10",
      },
    ];
    mockApi.get.mockResolvedValue({ data: response });

    const result = await getRecentReleases();
    expect(mockApi.get).toHaveBeenCalledWith("/library/recent-releases");
    expect(result).toEqual(response);
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("timeout"));
    await expect(getRecentReleases()).rejects.toThrow("timeout");
  });
});

describe("getReleaseFeed", () => {
  it("asks GET /library/releases for one window's page", async () => {
    const response = { releases: [], hasMore: false };
    mockApi.get.mockResolvedValue({ data: response });

    const result = await getReleaseFeed("upcoming", 24, 24);

    expect(mockApi.get).toHaveBeenCalledWith("/library/releases", {
      params: { when: "upcoming", offset: 24, limit: 24 },
    });
    expect(result).toEqual(response);
  });
});

describe("getNearbyShows", () => {
  const emptyResponse = {
    configured: true,
    location: null,
    shows: [],
  };

  it("calls GET /discover/nearby-shows without params when nothing is provided", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await getNearbyShows();
    expect(mockApi.get).toHaveBeenCalledWith("/discover/nearby-shows", {
      params: undefined,
    });
  });

  it.each([
    [{ zip: "10001" }, { zip: "10001" }],
    [
      { zip: "75001", country: "FR" },
      { zip: "75001", country: "FR" },
    ],
    [{ zip: "", country: "" }, undefined],
  ])("sends the location %o as %o", async (location, params) => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await getNearbyShows(location);
    expect(mockApi.get).toHaveBeenCalledWith("/discover/nearby-shows", {
      params,
    });
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("503"));
    await expect(getNearbyShows()).rejects.toThrow("503");
  });
});

describe("Browse playlists", () => {
  it("reads the shelf, its featured scope, Made for You, and a playlist by provider and id", async () => {
    mockApi.get.mockResolvedValue({ data: {} });

    await getEditorialShelf();
    await getEditorialShelf("featured");
    await getMadeForYou();
    await getEditorialPlaylist("deezer", "878989033");

    expect(mockApi.get.mock.calls).toEqual([
      ["/discover/playlists", { params: undefined }],
      ["/discover/playlists", { params: { scope: "featured" } }],
      ["/discover/playlists/made-for-you"],
      ["/discover/playlists/deezer/878989033"],
    ]);
  });

  it("saves a playlist through its library route", async () => {
    mockApi.post.mockResolvedValue({ data: {} });

    await addEditorialPlaylistToLibrary("deezer", "878989033");

    expect(mockApi.post).toHaveBeenCalledWith(
      "/discover/playlists/deezer/878989033/library",
    );
  });

  it("names the link lookup's query as the server reads it", async () => {
    mockApi.get.mockResolvedValue({ data: {} });
    const params = { artist: "Nirvana", album: "Nevermind", albumId: "119853" };

    await getEditorialLinks(params);

    expect(mockApi.get).toHaveBeenCalledWith("/discover/playlists/links", {
      params,
    });
  });
});
