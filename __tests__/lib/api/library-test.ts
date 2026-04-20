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
  getLibraryArtists,
  getLibraryArtist,
  getLibraryAlbums,
  getLibraryTracks,
  getArtistCover,
  getAlbumCover,
  triggerAlbumSearch,
  deleteAlbum,
} from "@/lib/api/library";

const mockApi = api as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getLibraryArtists", () => {
  it("calls GET /library/artists and returns data", async () => {
    const artists = [{ id: "1", artistName: "Test" }];
    mockApi.get.mockResolvedValue({ data: artists });

    const result = await getLibraryArtists();
    expect(mockApi.get).toHaveBeenCalledWith("/library/artists");
    expect(result).toEqual(artists);
  });
});

describe("getLibraryArtist", () => {
  it("calls GET /library/artists/:mbid", async () => {
    const artist = { id: "1", mbid: "abc-123", artistName: "Test" };
    mockApi.get.mockResolvedValue({ data: artist });

    const result = await getLibraryArtist("abc-123");
    expect(mockApi.get).toHaveBeenCalledWith("/library/artists/abc-123");
    expect(result).toEqual(artist);
  });
});

describe("getLibraryAlbums", () => {
  it("calls GET /library/albums with artistId param", async () => {
    const albums = [{ id: "1", albumName: "Album" }];
    mockApi.get.mockResolvedValue({ data: albums });

    const result = await getLibraryAlbums("42");
    expect(mockApi.get).toHaveBeenCalledWith("/library/albums", {
      params: { artistId: "42" },
    });
    expect(result).toEqual(albums);
  });
});

describe("getLibraryTracks", () => {
  it("calls GET /library/tracks with albumId param", async () => {
    const tracks = [{ id: "1", trackName: "Song" }];
    mockApi.get.mockResolvedValue({ data: tracks });

    const result = await getLibraryTracks("99");
    expect(mockApi.get).toHaveBeenCalledWith("/library/tracks", {
      params: { albumId: "99" },
    });
    expect(result).toEqual(tracks);
  });
});

describe("getArtistCover", () => {
  it("calls GET /artists/:mbid/cover", async () => {
    const cover = { images: [{ image: "https://img.com/1.jpg", front: true }] };
    mockApi.get.mockResolvedValue({ data: cover });

    const result = await getArtistCover("abc-123");
    expect(mockApi.get).toHaveBeenCalledWith("/artists/abc-123/cover");
    expect(result).toEqual(cover);
  });
});

describe("getAlbumCover", () => {
  it("calls GET /artists/release-group/:mbid/cover", async () => {
    const cover = { images: [{ image: "https://img.com/2.jpg", front: true }] };
    mockApi.get.mockResolvedValue({ data: cover });

    const result = await getAlbumCover("def-456");
    expect(mockApi.get).toHaveBeenCalledWith(
      "/artists/release-group/def-456/cover",
    );
    expect(result).toEqual(cover);
  });
});

describe("triggerAlbumSearch", () => {
  it("calls POST /library/downloads/album/search", async () => {
    mockApi.post.mockResolvedValue({ data: { success: true } });

    const result = await triggerAlbumSearch("99");
    expect(mockApi.post).toHaveBeenCalledWith(
      "/library/downloads/album/search",
      { albumId: "99" },
    );
    expect(result).toEqual({ success: true });
  });
});

describe("deleteAlbum", () => {
  it("calls DELETE /library/albums/:id with deleteFiles param", async () => {
    mockApi.delete.mockResolvedValue({ data: { success: true } });

    const result = await deleteAlbum("99");
    expect(mockApi.delete).toHaveBeenCalledWith("/library/albums/99", {
      params: { deleteFiles: false },
    });
    expect(result).toEqual({ success: true });
  });

  it("passes deleteFiles=true when specified", async () => {
    mockApi.delete.mockResolvedValue({ data: { success: true } });

    await deleteAlbum("99", true);
    expect(mockApi.delete).toHaveBeenCalledWith("/library/albums/99", {
      params: { deleteFiles: true },
    });
  });
});
