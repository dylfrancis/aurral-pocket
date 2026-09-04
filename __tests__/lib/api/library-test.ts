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
  getLibraryArtist,
  getCanonicalLibraryPage,
  getCanonicalAlbumTracks,
  getCanonicalArtistAlbums,
  refreshCanonicalLibrary,
  getCanonicalLibraryRefresh,
  getArtistCover,
  getAlbumCover,
  triggerAlbumSearch,
  updateLibraryAlbum,
  deleteAlbum,
  requestAlbumFromSearch,
  favoriteEntityId,
  getLibraryFavorites,
  updateLibraryFavorites,
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

describe("getLibraryArtist", () => {
  it("calls GET /library/artists/:mbid", async () => {
    const artist = { id: "1", mbid: "abc-123", artistName: "Test" };
    mockApi.get.mockResolvedValue({ data: artist });

    const result = await getLibraryArtist("abc-123");
    expect(mockApi.get).toHaveBeenCalledWith("/library/artists/abc-123");
    expect(result).toEqual(artist);
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

describe("updateLibraryAlbum", () => {
  it("calls PUT /library/albums/:id with the body and returns data", async () => {
    const album = { id: "99", albumName: "Album", monitored: true };
    mockApi.put.mockResolvedValue({ data: album });

    const result = await updateLibraryAlbum("99", { monitored: true });
    expect(mockApi.put).toHaveBeenCalledWith("/library/albums/99", {
      monitored: true,
    });
    expect(result).toEqual(album);
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

describe("requestAlbumFromSearch", () => {
  const payload = {
    albumMbid: "rg-1",
    albumName: "Abbey Road",
    artistMbid: "artist-1",
    artistName: "The Beatles",
  };

  it("posts to /library/albums/request with the payload", async () => {
    mockApi.post.mockResolvedValue({ data: { createdArtist: false } });

    await requestAlbumFromSearch(payload);
    expect(mockApi.post).toHaveBeenCalledWith(
      "/library/albums/request",
      payload,
    );
  });

  it("returns the response data", async () => {
    mockApi.post.mockResolvedValue({ data: { createdArtist: true } });

    const result = await requestAlbumFromSearch(payload);
    expect(result).toEqual({ createdArtist: true });
  });

  it("propagates errors", async () => {
    mockApi.post.mockRejectedValue(new Error("409"));
    await expect(requestAlbumFromSearch(payload)).rejects.toThrow("409");
  });
});

describe("getCanonicalLibraryPage", () => {
  it("sends only the parameters the caller set", async () => {
    mockApi.get.mockResolvedValue({ data: { kind: "albums" } });

    await getCanonicalLibraryPage({ kind: "albums", page: 2, pageSize: 50 });
    expect(mockApi.get).toHaveBeenCalledWith("/library/canonical", {
      params: { kind: "albums", page: "2", pageSize: "50" },
    });
  });

  it("serialises every supported filter", async () => {
    mockApi.get.mockResolvedValue({ data: { kind: "tracks" } });

    await getCanonicalLibraryPage({
      kind: "tracks",
      source: "lidarr",
      availableOnly: true,
      page: 1,
      pageSize: 100,
      query: "wave",
      genre: "Jazz",
      sort: "newest",
      direction: "desc",
      artistId: "art1",
      albumId: "alb1",
    });
    expect(mockApi.get).toHaveBeenCalledWith("/library/canonical", {
      params: {
        kind: "tracks",
        source: "lidarr",
        availableOnly: "true",
        page: "1",
        pageSize: "100",
        query: "wave",
        genre: "Jazz",
        sort: "newest",
        direction: "desc",
        artistId: "art1",
        albumId: "alb1",
      },
    });
  });

  it("omits availableOnly when it is false", async () => {
    mockApi.get.mockResolvedValue({ data: { kind: "artists" } });

    await getCanonicalLibraryPage({ kind: "artists", availableOnly: false });
    expect(mockApi.get).toHaveBeenCalledWith("/library/canonical", {
      params: { kind: "artists", pageSize: "100" },
    });
  });

  it("defaults pageSize to 100 because Aurral 2.6 rejects requests without it", async () => {
    mockApi.get.mockResolvedValue({ data: { kind: "genres" } });

    await getCanonicalLibraryPage({ kind: "genres" });
    expect(mockApi.get).toHaveBeenCalledWith("/library/canonical", {
      params: { kind: "genres", pageSize: "100" },
    });
  });

  it("maps raw canonical artist rows to the legacy Artist shape", async () => {
    // The canonical route returns raw library rows: the name lives in `name`,
    // the counts are flat, and the id is a number. Reading `artistName` off a
    // raw row crashed the library screen's sort.
    mockApi.get.mockResolvedValue({
      data: {
        kind: "artists",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [
          {
            id: 7,
            identityKey: "artist:radiohead",
            mbid: "mb-1",
            name: "Radiohead",
            sortName: "Radiohead",
            metadata: {
              foreignArtistId: "fa-1",
              monitored: true,
              monitor: "all",
              added: "2020-01-01T00:00:00Z",
            },
            albumCount: 3,
            trackCount: 30,
            sizeOnDisk: 123,
            sources: ["lidarr"],
            available: true,
          },
        ],
        albums: [],
        tracks: [],
      },
    });

    const page = await getCanonicalLibraryPage({ kind: "artists" });
    expect(page.artists).toEqual([
      {
        id: "7",
        canonicalId: "7",
        mbid: "mb-1",
        foreignArtistId: "fa-1",
        artistName: "Radiohead",
        monitored: true,
        monitorOption: "all",
        addedAt: "2020-01-01T00:00:00Z",
        statistics: { albumCount: 3, trackCount: 30, sizeOnDisk: 123 },
        sources: ["lidarr"],
        available: true,
        identityKey: "artist:radiohead",
      },
    ]);
  });

  it("maps raw canonical album rows to the legacy Album shape", async () => {
    // The canonical route returns raw album rows plus the counts the page
    // route adds (trackCount, availableTrackCount). The screens read the
    // legacy Album shape, so the page must map every row before returning.
    mockApi.get.mockResolvedValue({
      data: {
        kind: "albums",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [],
        albums: [
          {
            id: 12,
            identityKey: "album:in-rainbows",
            mbid: "mb-album-1",
            releaseGroupMbid: "mb-rg-1",
            artistId: 7,
            title: "In Rainbows",
            albumArtist: "Radiohead",
            releaseDate: "2007-10-10",
            metadata: { monitored: true },
            trackCount: 10,
            availableTrackCount: 5,
            sources: ["lidarr"],
            available: true,
          },
        ],
        tracks: [],
      },
    });

    const page = await getCanonicalLibraryPage({ kind: "albums" });
    expect(page.albums).toEqual([
      {
        id: "12",
        canonicalId: "12",
        artistId: "7",
        artistName: "Radiohead",
        mbid: "mb-album-1",
        foreignAlbumId: "mb-album-1",
        albumName: "In Rainbows",
        title: "In Rainbows",
        releaseDate: "2007-10-10",
        monitored: true,
        statistics: {
          trackCount: 10,
          trackFileCount: 5,
          sizeOnDisk: 0,
          percentOfTracks: 50,
        },
        sources: ["lidarr"],
        available: true,
        identityKey: "album:in-rainbows",
      },
    ]);
  });

  it("maps a wanted album with no files to zero percent", async () => {
    // A monitored album that is still downloading has canonical track rows
    // but no media files. The artist screen must keep showing it at 0%.
    mockApi.get.mockResolvedValue({
      data: {
        kind: "albums",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [],
        albums: [
          {
            id: 13,
            identityKey: "album:wanted",
            mbid: null,
            releaseGroupMbid: "mb-rg-2",
            artistId: 7,
            title: "Wanted Album",
            albumArtist: "Radiohead",
            releaseDate: null,
            metadata: { monitored: true },
            trackCount: 8,
            availableTrackCount: 0,
            sources: ["lidarr"],
            available: false,
          },
        ],
        tracks: [],
      },
    });

    const page = await getCanonicalLibraryPage({ kind: "albums" });
    expect(page.albums).toEqual([
      {
        id: "13",
        canonicalId: "13",
        artistId: "7",
        artistName: "Radiohead",
        mbid: "mb-rg-2",
        foreignAlbumId: "mb-rg-2",
        albumName: "Wanted Album",
        title: "Wanted Album",
        releaseDate: null,
        monitored: true,
        statistics: {
          trackCount: 8,
          trackFileCount: 0,
          sizeOnDisk: 0,
          percentOfTracks: 0,
        },
        sources: ["lidarr"],
        available: false,
        identityKey: "album:wanted",
      },
    ]);
  });

  it("falls back to Lidarr's statistics when Aurral cannot see the files", async () => {
    // Aurral marks a Lidarr file available only when it can stat the path on
    // its own filesystem. Without a shared mount every canonical count is 0,
    // while Lidarr itself has the album complete. The web UI reads Lidarr's
    // own statistics for its status dot; the mapper falls back the same way.
    mockApi.get.mockResolvedValue({
      data: {
        kind: "albums",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [],
        albums: [
          {
            id: 14,
            identityKey: "album:unseen",
            mbid: "mb-album-3",
            releaseGroupMbid: "mb-rg-3",
            artistId: 7,
            title: "Unseen Album",
            albumArtist: "Radiohead",
            releaseDate: "2003-06-09",
            metadata: {
              monitored: true,
              librarySource: "lidarr",
              statistics: {
                trackCount: 10,
                trackFileCount: 10,
                sizeOnDisk: 350000000,
                percentOfTracks: 100,
              },
            },
            trackCount: 10,
            availableTrackCount: 0,
            sources: ["lidarr"],
            available: false,
          },
        ],
        tracks: [],
      },
    });

    const page = await getCanonicalLibraryPage({ kind: "albums" });
    expect(page.albums[0].statistics).toEqual({
      trackCount: 10,
      trackFileCount: 0,
      sizeOnDisk: 350000000,
      percentOfTracks: 100,
    });
  });

  it("keeps the canonical percent when it is larger than Lidarr's", async () => {
    // An album Aurral downloaded itself can be more complete than Lidarr
    // believes. The larger value wins, so an Aurral-only album never loses
    // its real ratio to a stale Lidarr statistic.
    mockApi.get.mockResolvedValue({
      data: {
        kind: "albums",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [],
        albums: [
          {
            id: 15,
            identityKey: "album:mixed",
            mbid: "mb-album-4",
            releaseGroupMbid: "mb-rg-4",
            artistId: 7,
            title: "Mixed Album",
            albumArtist: "Radiohead",
            releaseDate: "2011-02-18",
            metadata: {
              monitored: true,
              librarySource: "lidarr",
              statistics: {
                trackCount: 4,
                trackFileCount: 2,
                sizeOnDisk: 90000000,
                percentOfTracks: 50,
              },
            },
            trackCount: 4,
            availableTrackCount: 3,
            sources: ["lidarr", "aurral"],
            available: true,
          },
        ],
        tracks: [],
      },
    });

    const page = await getCanonicalLibraryPage({ kind: "albums" });
    expect(page.albums[0].statistics).toEqual({
      trackCount: 4,
      trackFileCount: 3,
      sizeOnDisk: 90000000,
      percentOfTracks: 75,
    });
  });

  it("maps raw canonical track rows to the legacy Track shape", async () => {
    // Track pages are read per album. The mapper matches the track's album
    // link against the requested albumId for the track number, and derives
    // streamPath the same way the server's read adapter does.
    mockApi.get.mockResolvedValue({
      data: {
        kind: "tracks",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [],
        albums: [],
        tracks: [
          {
            id: 31,
            identityKey: "song:weird-fishes",
            mbid: "mb-track-1",
            title: "Weird Fishes",
            artistName: "Radiohead",
            albums: [
              { albumId: 99, discNumber: 1, trackNumber: 9 },
              { albumId: 12, discNumber: 1, trackNumber: 4 },
            ],
            files: [
              {
                id: 501,
                albumId: 12,
                source: "lidarr",
                format: "flac",
                size: 31457280,
                quality: { format: "FLAC", bitrate: 1024000 },
                available: true,
              },
            ],
            sources: ["lidarr"],
            available: true,
          },
        ],
      },
    });

    const page = await getCanonicalLibraryPage({
      kind: "tracks",
      albumId: "12",
    });
    expect(page.tracks).toEqual([
      {
        id: "31",
        mbid: "mb-track-1",
        trackName: "Weird Fishes",
        title: "Weird Fishes",
        trackNumber: 4,
        hasFile: true,
        size: 31457280,
        quality: "FLAC",
        streamPath: "/library/canonical-stream/12/31",
        streamFormat: "flac",
        sources: ["lidarr"],
        available: true,
        artistName: "Radiohead",
        identityKey: "song:weird-fishes",
      },
    ]);
  });

  it("maps a wanted track with no file to a null streamPath", async () => {
    // A track the library wants but does not own drives the missing marker
    // in the track list, and must never look playable.
    mockApi.get.mockResolvedValue({
      data: {
        kind: "tracks",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [],
        albums: [],
        tracks: [
          {
            id: 32,
            identityKey: "song:wanted",
            mbid: null,
            title: "Wanted Track",
            albums: [{ albumId: 12, discNumber: 1, trackNumber: 5 }],
            files: [],
            sources: ["lidarr"],
            available: false,
          },
        ],
      },
    });

    const page = await getCanonicalLibraryPage({
      kind: "tracks",
      albumId: "12",
    });
    expect(page.tracks).toEqual([
      {
        id: "32",
        mbid: "",
        trackName: "Wanted Track",
        title: "Wanted Track",
        trackNumber: 5,
        hasFile: false,
        size: 0,
        quality: null,
        streamPath: null,
        streamFormat: null,
        sources: ["lidarr"],
        available: false,
        identityKey: "song:wanted",
      },
    ]);
  });

  it("marks a track Lidarr owns as present even though Aurral cannot stream it", async () => {
    // The stored Lidarr track payload carries Lidarr's own hasFile flag.
    // When Aurral cannot see the file, the track keeps its checkmark — the
    // web UI shows the same — but streamPath stays null, because Aurral
    // cannot serve a file it cannot read.
    mockApi.get.mockResolvedValue({
      data: {
        kind: "tracks",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [],
        albums: [],
        tracks: [
          {
            id: 34,
            identityKey: "song:unseen",
            mbid: "mb-track-4",
            title: "Unseen Track",
            metadata: { hasFile: true },
            albums: [{ albumId: 12, discNumber: 1, trackNumber: 7 }],
            files: [],
            sources: ["lidarr"],
            available: false,
          },
        ],
      },
    });

    const page = await getCanonicalLibraryPage({
      kind: "tracks",
      albumId: "12",
    });
    expect(page.tracks[0]).toMatchObject({
      hasFile: true,
      streamPath: null,
      streamFormat: null,
      available: false,
    });
  });

  it("streams from an available unscoped file when the album-scoped file is unavailable", async () => {
    // A file scanned without an album link can still serve the track. The
    // pick order mirrors the server adapter: available album-scoped file,
    // then available unscoped file, then any file.
    mockApi.get.mockResolvedValue({
      data: {
        kind: "tracks",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [],
        albums: [],
        tracks: [
          {
            id: 33,
            identityKey: "song:two-files",
            mbid: "mb-track-3",
            title: "Two Files",
            albums: [{ albumId: 12, discNumber: 1, trackNumber: 6 }],
            files: [
              {
                id: 601,
                albumId: 12,
                format: "mp3",
                size: 100,
                available: false,
              },
              {
                id: 602,
                albumId: null,
                format: "flac",
                size: 200,
                available: true,
              },
            ],
            sources: ["aurral"],
            available: true,
          },
        ],
      },
    });

    const page = await getCanonicalLibraryPage({
      kind: "tracks",
      albumId: "12",
    });
    expect(page.tracks[0]).toMatchObject({
      hasFile: true,
      size: 200,
      streamFormat: "flac",
      streamPath: "/library/canonical-stream/12/33",
    });
  });

  it("fills defaults for a file-scanned artist that carries no metadata", async () => {
    mockApi.get.mockResolvedValue({
      data: {
        kind: "artists",
        page: 1,
        pageSize: 100,
        total: 1,
        hasMore: false,
        artists: [
          { id: 8, identityKey: "artist:unknown", mbid: null, name: "Unknown" },
        ],
        albums: [],
        tracks: [],
      },
    });

    const page = await getCanonicalLibraryPage({ kind: "artists" });
    expect(page.artists).toEqual([
      {
        id: "8",
        canonicalId: "8",
        mbid: "",
        foreignArtistId: "artist:unknown",
        artistName: "Unknown",
        monitored: false,
        monitorOption: "none",
        addedAt: null,
        statistics: { albumCount: 0, trackCount: 0, sizeOnDisk: 0 },
        sources: undefined,
        available: undefined,
        identityKey: "artist:unknown",
      },
    ]);
  });
});

function trackRow(id: number, title: string) {
  return {
    id,
    identityKey: `song:${id}`,
    mbid: `mb-${id}`,
    title,
    albums: [{ albumId: 12, discNumber: 1, trackNumber: 1 }],
    files: [
      { id: id * 10, albumId: 12, format: "flac", size: 1, available: true },
    ],
    sources: ["lidarr"],
    available: true,
  };
}

function trackPage(page: number, hasMore: boolean, rows: unknown[]) {
  return {
    data: {
      kind: "tracks",
      page,
      pageSize: 100,
      total: 150,
      hasMore,
      artists: [],
      albums: [],
      tracks: rows,
    },
  };
}

function artistRow(id: number, mbid: string | null, name: string) {
  return { id, identityKey: `artist:${id}`, mbid, name };
}

function artistPage(page: number, hasMore: boolean, rows: unknown[]) {
  return {
    data: {
      kind: "artists",
      page,
      pageSize: 100,
      total: 150,
      hasMore,
      artists: rows,
      albums: [],
      tracks: [],
    },
  };
}

function albumRow(id: number, title: string) {
  return {
    id,
    identityKey: `album:${id}`,
    mbid: `mb-alb-${id}`,
    releaseGroupMbid: `mb-rg-${id}`,
    artistId: 7,
    title,
    albumArtist: "Radiohead",
    releaseDate: null,
    metadata: { monitored: true },
    trackCount: 10,
    availableTrackCount: 10,
    available: true,
  };
}

function albumPage(page: number, hasMore: boolean, rows: unknown[]) {
  return {
    data: {
      kind: "albums",
      page,
      pageSize: 100,
      total: 150,
      hasMore,
      artists: [],
      albums: rows,
      tracks: [],
    },
  };
}

describe("getCanonicalArtistAlbums", () => {
  it("resolves the artist by MBID, then drains that artist's albums", async () => {
    // The paged canonical route matches artistId against the canonical
    // numeric id only, and the screens hold an MBID. The read walks the
    // artist pages to translate one into the other.
    mockApi.get
      .mockResolvedValueOnce(
        artistPage(1, false, [
          artistRow(6, "mb-other", "Other"),
          artistRow(7, "mb-artist-1", "Radiohead"),
        ]),
      )
      .mockResolvedValueOnce(albumPage(1, true, [albumRow(12, "In Rainbows")]))
      .mockResolvedValueOnce(albumPage(2, false, [albumRow(13, "Kid A")]));

    const albums = await getCanonicalArtistAlbums("mb-artist-1");

    expect(mockApi.get).toHaveBeenNthCalledWith(2, "/library/canonical", {
      params: {
        kind: "albums",
        pageSize: "100",
        source: "all",
        page: "1",
        artistId: "7",
      },
    });
    expect(albums.map((a) => a.title)).toEqual(["In Rainbows", "Kid A"]);
    expect(albums[0].canonicalId).toBe("12");
  });

  it("returns no albums when the canonical library has not indexed the artist yet", async () => {
    // An artist added a minute ago is not in the canonical library until a
    // scan runs. The screen shows an empty album list and keeps polling.
    mockApi.get.mockResolvedValueOnce(
      artistPage(1, false, [artistRow(6, "mb-other", "Other")]),
    );

    const albums = await getCanonicalArtistAlbums("mb-artist-1");

    expect(albums).toEqual([]);
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to a canonical-id match for an artist with no MBID", async () => {
    // A file-scanned artist has no MBID, so the library list navigates by
    // its canonical id, and that id is the reference that arrives here.
    mockApi.get
      .mockResolvedValueOnce(
        artistPage(1, false, [artistRow(8, null, "Unknown")]),
      )
      .mockResolvedValueOnce(albumPage(1, false, [albumRow(14, "Tape")]));

    const albums = await getCanonicalArtistAlbums("8");

    expect(mockApi.get).toHaveBeenNthCalledWith(2, "/library/canonical", {
      params: {
        kind: "albums",
        pageSize: "100",
        source: "all",
        page: "1",
        artistId: "8",
      },
    });
    expect(albums.map((a) => a.title)).toEqual(["Tape"]);
  });
});

describe("getCanonicalAlbumTracks", () => {
  it("drains every page of an album's tracks in order", async () => {
    // Aurral 2.6 caps a canonical read at 100 items, and box sets exceed
    // that. The read must follow hasMore until the album is complete.
    mockApi.get
      .mockResolvedValueOnce(trackPage(1, true, [trackRow(31, "One")]))
      .mockResolvedValueOnce(trackPage(2, false, [trackRow(32, "Two")]));

    const tracks = await getCanonicalAlbumTracks("12");

    expect(mockApi.get).toHaveBeenNthCalledWith(1, "/library/canonical", {
      params: {
        kind: "tracks",
        pageSize: "100",
        source: "all",
        page: "1",
        albumId: "12",
      },
    });
    expect(mockApi.get).toHaveBeenNthCalledWith(2, "/library/canonical", {
      params: {
        kind: "tracks",
        pageSize: "100",
        source: "all",
        page: "2",
        albumId: "12",
      },
    });
    expect(tracks.map((t) => t.title)).toEqual(["One", "Two"]);
    expect(tracks[0].streamPath).toBe("/library/canonical-stream/12/31");
  });
});

describe("canonical library scan", () => {
  it("queues a scan", async () => {
    const job = {
      queued: true,
      jobId: 1,
      status: { jobId: 1, status: "queued", error: null },
    };
    mockApi.post.mockResolvedValue({ data: job });

    const result = await refreshCanonicalLibrary();
    expect(mockApi.post).toHaveBeenCalledWith("/library/refresh");
    expect(result).toEqual(job);
  });

  it("reads one scan status", async () => {
    const status = { jobId: 1, status: "running", error: null };
    mockApi.get.mockResolvedValue({ data: status });

    const result = await getCanonicalLibraryRefresh(1);
    expect(mockApi.get).toHaveBeenCalledWith("/library/refresh/1");
    expect(result).toEqual(status);
  });
});

describe("favoriteEntityId", () => {
  it("prefixes the kind and percent-encodes the identity key", () => {
    expect(favoriteEntityId("artist", "Simon & Garfunkel")).toBe(
      "artist:Simon%20%26%20Garfunkel",
    );
    expect(favoriteEntityId("album", "AC/DC|Back in Black")).toBe(
      "album:AC%2FDC%7CBack%20in%20Black",
    );
    expect(favoriteEntityId("song", "plain")).toBe("song:plain");
  });
});

describe("getLibraryFavorites", () => {
  // The server answers with every starred id, plus a `library` block that also
  // carries the children of starred entities. Only the starred rows may escape.
  const wire = {
    artist: [{ id: "artist:radiohead" }],
    album: [{ id: "album:in-rainbows" }],
    song: [{ id: "song:nude" }],
    library: {
      artists: [
        { id: "1", name: "Radiohead", identityKey: "radiohead" },
        { id: "2", name: "Not Starred", identityKey: "portishead" },
      ],
      albums: [
        { id: "10", title: "In Rainbows", identityKey: "in-rainbows" },
        { id: "11", title: "Child Of A Starred Artist", identityKey: "kid-a" },
      ],
      tracks: [
        { id: "100", title: "Nude", identityKey: "nude" },
        {
          id: "101",
          title: "Child Of A Starred Album",
          identityKey: "reckoner",
        },
      ],
    },
  };

  it("keeps only the starred rows and drops the children", async () => {
    mockApi.get.mockResolvedValue({ data: wire });

    const result = await getLibraryFavorites();
    expect(mockApi.get).toHaveBeenCalledWith("/library/favorites");
    expect(result.artists.map((a) => a.artistName)).toEqual(["Radiohead"]);
    expect(result.albums.map((a) => a.title)).toEqual(["In Rainbows"]);
    expect(result.tracks.map((t) => t.title)).toEqual(["Nude"]);
  });

  it("matches on the encoded id, not the raw identity key", async () => {
    mockApi.get.mockResolvedValue({
      data: {
        artist: [{ id: "artist:Simon%20%26%20Garfunkel" }],
        library: {
          artists: [
            {
              id: "1",
              name: "Simon & Garfunkel",
              identityKey: "Simon & Garfunkel",
            },
          ],
        },
      },
    });

    const result = await getLibraryFavorites();
    expect(result.artists.map((a) => a.artistName)).toEqual([
      "Simon & Garfunkel",
    ]);
  });

  it("drops rows with no identity key rather than matching them loosely", async () => {
    mockApi.get.mockResolvedValue({
      data: {
        artist: [{ id: "artist:undefined" }],
        library: { artists: [{ id: "1", name: "Keyless" }] },
      },
    });

    expect((await getLibraryFavorites()).artists).toEqual([]);
  });

  it("reads an empty response as empty sections", async () => {
    mockApi.get.mockResolvedValue({ data: {} });

    expect(await getLibraryFavorites()).toEqual({
      artists: [],
      albums: [],
      tracks: [],
    });
  });
});

describe("updateLibraryFavorites", () => {
  it("posts the ids and the starred flag", async () => {
    mockApi.post.mockResolvedValue({ data: { changedIds: ["album:x"] } });

    const result = await updateLibraryFavorites(["album:x"], true);
    expect(mockApi.post).toHaveBeenCalledWith("/library/favorites", {
      ids: ["album:x"],
      starred: true,
    });
    expect(result).toEqual({ changedIds: ["album:x"] });
  });
});
