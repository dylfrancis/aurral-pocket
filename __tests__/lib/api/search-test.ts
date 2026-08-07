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
  searchArtists,
  searchAlbums,
  addArtist,
  getSimilarArtists,
  getDiscovery,
  getRecentlyAdded,
  getRecentReleases,
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
  // Aurral 2.0 deleted /search/artists; /search/unified replaced it.
  const unified = (artists: unknown[]) => ({
    query: "radiohead",
    mode: "suggest",
    library: { artists: [] },
    catalog: { artists },
  });

  it("calls GET /search/unified and normalises catalog artists", async () => {
    mockApi.get.mockResolvedValue({
      data: unified([
        {
          type: "artist",
          source: "brainzmash",
          id: "mbid-1",
          key: "mbid-1",
          name: "Radiohead",
          sortName: "Radiohead",
          inLibrary: true,
          hasMbid: true,
          score: 100,
        },
      ]),
    });

    const result = await searchArtists("radiohead");

    expect(mockApi.get).toHaveBeenCalledWith("/search/unified", {
      params: { q: "radiohead", mode: "suggest", limit: 24 },
      timeout: 12_000,
    });
    expect(result).toEqual({
      artists: [
        {
          id: "mbid-1",
          name: "Radiohead",
          sortName: "Radiohead",
          inLibrary: true,
          score: 100,
        },
      ],
    });
  });

  it("reads catalog rather than library, which would duplicate results", async () => {
    // catalog.artists already contains library artists, flagged inLibrary.
    mockApi.get.mockResolvedValue({
      data: {
        catalog: {
          artists: [
            { id: "mbid-1", name: "Radiohead", hasMbid: true, inLibrary: true },
          ],
        },
        library: {
          artists: [
            { id: "mbid-1", name: "Radiohead", hasMbid: true, inLibrary: true },
          ],
        },
      },
    });

    const result = await searchArtists("radiohead");
    expect(result.artists).toHaveLength(1);
  });

  it("drops entries without an MBID", async () => {
    // Every action pocket offers addresses the artist by MBID, so an entry
    // without one cannot produce a working row.
    mockApi.get.mockResolvedValue({
      data: unified([
        { id: "mbid-1", name: "Has MBID", hasMbid: true },
        { id: "local-7", name: "No MBID", hasMbid: false },
      ]),
    });

    const result = await searchArtists("x");
    expect(result.artists.map((a) => a.id)).toEqual(["mbid-1"]);
  });

  it("defaults optional fields the backend may omit", async () => {
    mockApi.get.mockResolvedValue({
      data: unified([{ id: "mbid-1", name: "Sparse" }]),
    });

    const result = await searchArtists("x");
    expect(result.artists[0]).toEqual({
      id: "mbid-1",
      name: "Sparse",
      sortName: "Sparse",
      inLibrary: false,
      score: 0,
    });
  });

  it("allows full mode a longer timeout than suggest", async () => {
    mockApi.get.mockResolvedValue({ data: unified([]) });

    await searchArtists("test", { mode: "full", limit: 10 });
    expect(mockApi.get).toHaveBeenCalledWith("/search/unified", {
      params: { q: "test", mode: "full", limit: 10 },
      timeout: 30_000,
    });
  });

  it("returns an empty list when the response has no catalog", async () => {
    mockApi.get.mockResolvedValue({ data: { query: "x", mode: "suggest" } });

    const result = await searchArtists("x");
    expect(result.artists).toEqual([]);
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("Network error"));
    await expect(searchArtists("test")).rejects.toThrow("Network error");
  });
});

describe("searchAlbums", () => {
  const emptyResponse = {
    scope: "album",
    query: "abbey road",
    count: 0,
    offset: 0,
    items: [],
  };

  it("calls GET /search with album scope and default limit/offset", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await searchAlbums("abbey road");
    expect(mockApi.get).toHaveBeenCalledWith("/search", {
      params: { q: "abbey road", scope: "album", limit: 24, offset: 0 },
    });
  });

  it("passes custom limit and offset", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await searchAlbums("test", 10, 20);
    expect(mockApi.get).toHaveBeenCalledWith("/search", {
      params: { q: "test", scope: "album", limit: 10, offset: 20 },
    });
  });

  it("returns the response payload unchanged", async () => {
    const response = {
      scope: "album",
      query: "abbey road",
      count: 1,
      offset: 0,
      items: [
        {
          type: "album",
          id: "rg-1",
          title: "Abbey Road",
          artistName: "The Beatles",
          artistMbid: "artist-mbid",
          releaseDate: "1969-09-26",
          primaryType: "Album",
          secondaryTypes: [],
          coverUrl: null,
          inLibrary: false,
          libraryAlbumId: null,
          libraryArtistId: null,
          status: "missing",
        },
      ],
    };
    mockApi.get.mockResolvedValue({ data: response });

    const result = await searchAlbums("abbey road");
    expect(result).toEqual(response);
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("503"));
    await expect(searchAlbums("test")).rejects.toThrow("503");
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
      monitorOption: "all",
    });
    expect(mockApi.post).toHaveBeenCalledWith("/library/artists", {
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      monitorOption: "all",
    });
    expect(result).toEqual(response);
  });

  it("propagates errors", async () => {
    mockApi.post.mockRejectedValue(new Error("Conflict"));
    await expect(
      addArtist({ foreignArtistId: "abc", artistName: "Test" }),
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
    isUpdating: false,
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

  it("includes zip when provided", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await getNearbyShows("10001");
    expect(mockApi.get).toHaveBeenCalledWith("/discover/nearby-shows", {
      params: { zip: "10001" },
    });
  });

  it("trims whitespace from zip", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await getNearbyShows("  94110  ");
    expect(mockApi.get).toHaveBeenCalledWith("/discover/nearby-shows", {
      params: { zip: "94110" },
    });
  });

  it("omits zip when blank or whitespace-only", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await getNearbyShows("   ");
    expect(mockApi.get).toHaveBeenCalledWith("/discover/nearby-shows", {
      params: undefined,
    });
  });

  it("includes limit when it is a positive finite number", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await getNearbyShows("10001", 15);
    expect(mockApi.get).toHaveBeenCalledWith("/discover/nearby-shows", {
      params: { zip: "10001", limit: 15 },
    });
  });

  it("floors fractional limits", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await getNearbyShows(undefined, 12.7);
    expect(mockApi.get).toHaveBeenCalledWith("/discover/nearby-shows", {
      params: { limit: 12 },
    });
  });

  it("omits limit when zero, negative, or non-finite", async () => {
    mockApi.get.mockResolvedValue({ data: emptyResponse });

    await getNearbyShows("10001", 0);
    await getNearbyShows("10001", -5);
    await getNearbyShows("10001", Number.NaN);

    for (const call of mockApi.get.mock.calls) {
      expect(call[1].params).not.toHaveProperty("limit");
    }
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("503"));
    await expect(getNearbyShows()).rejects.toThrow("503");
  });
});
