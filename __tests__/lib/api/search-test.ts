jest.mock("@/lib/api/client", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { api } from "@/lib/api/client";
import { searchArtists, addArtist, getSimilarArtists } from "@/lib/api/search";

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
  it("calls GET /search/artists with query, limit, and offset params", async () => {
    const response = {
      artists: [
        {
          id: "1",
          name: "Radiohead",
          "sort-name": "Radiohead",
          image: null,
          imageUrl: null,
          listeners: null,
        },
      ],
      count: 1,
      offset: 0,
    };
    mockApi.get.mockResolvedValue({ data: response });

    const result = await searchArtists("radiohead");
    expect(mockApi.get).toHaveBeenCalledWith("/search/artists", {
      params: { query: "radiohead", limit: 24, offset: 0 },
    });
    expect(result).toEqual(response);
  });

  it("passes custom limit and offset", async () => {
    mockApi.get.mockResolvedValue({
      data: { artists: [], count: 0, offset: 10 },
    });

    await searchArtists("test", 10, 10);
    expect(mockApi.get).toHaveBeenCalledWith("/search/artists", {
      params: { query: "test", limit: 10, offset: 10 },
    });
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("Network error"));
    await expect(searchArtists("test")).rejects.toThrow("Network error");
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
