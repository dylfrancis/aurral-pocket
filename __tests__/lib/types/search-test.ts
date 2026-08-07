import type {
  SearchArtist,
  SearchArtistsResponse,
  SimilarArtist,
  SimilarArtistsResponse,
  MonitorOption,
  AddArtistRequest,
  AddArtistResponse,
} from "@/lib/types/search";

describe("search types", () => {
  it("SearchArtist has correct shape", () => {
    const artist: SearchArtist = {
      id: "mbid-1",
      name: "Radiohead",
      sortName: "Radiohead",
      inLibrary: true,
      score: 100,
    };
    expect(artist.id).toBe("mbid-1");
    expect(artist.name).toBe("Radiohead");
    expect(artist.sortName).toBe("Radiohead");
    expect(artist.inLibrary).toBe(true);
    expect(artist.score).toBe(100);
  });

  it("SearchArtistsResponse wraps artists with no paging metadata", () => {
    // /search/unified is not paged, and nothing in pocket paginates artists.
    const response: SearchArtistsResponse = {
      artists: [
        {
          id: "1",
          name: "Test",
          sortName: "Test",
          inLibrary: false,
          score: 0,
        },
      ],
    };
    expect(response.artists).toHaveLength(1);
  });

  it("SimilarArtist has match score", () => {
    const artist: SimilarArtist = {
      id: "mbid-3",
      name: "Atoms for Peace",
      image: "https://img.com/afp.jpg",
      match: 85,
    };
    expect(artist.match).toBe(85);
  });

  it("SimilarArtistsResponse wraps artists array", () => {
    const response: SimilarArtistsResponse = {
      artists: [{ id: "1", name: "Test", image: null, match: 50 }],
    };
    expect(response.artists).toHaveLength(1);
  });

  it("MonitorOption covers all valid values", () => {
    const options: MonitorOption[] = [
      "none",
      "all",
      "existing",
      "latest",
      "first",
      "missing",
      "future",
    ];
    expect(options).toHaveLength(7);
  });

  it("AddArtistRequest has foreignArtistId and artistName", () => {
    const request: AddArtistRequest = {
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      monitorOption: "all",
    };
    expect(request.foreignArtistId).toBe("abc-123");
    expect(request.artistName).toBe("Radiohead");
  });

  it("AddArtistRequest works with only required fields", () => {
    const request: AddArtistRequest = {
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
    };
    expect(request.quality).toBeUndefined();
    expect(request.monitorOption).toBeUndefined();
  });

  it("AddArtistResponse has queued flag", () => {
    const response: AddArtistResponse = {
      queued: true,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
    };
    expect(response.queued).toBe(true);
    expect(response.artist).toBeUndefined();
  });

  it("AddArtistResponse includes artist when already exists", () => {
    const response: AddArtistResponse = {
      queued: false,
      foreignArtistId: "abc-123",
      artistName: "Radiohead",
      artist: {
        id: "42",
        mbid: "abc-123",
        foreignArtistId: "abc-123",
        artistName: "Radiohead",
        monitored: true,
        monitorOption: "all",
        statistics: { albumCount: 9, trackCount: 101, sizeOnDisk: 0 },
      },
    };
    expect(response.queued).toBe(false);
    expect(response.artist?.id).toBe("42");
  });
});
