import type {
  Artist,
  Album,
  Track,
  CoverArtResponse,
  CoverArtType,
} from "@/lib/types/library";

describe("Library types", () => {
  it("Artist type has correct shape", () => {
    const artist: Artist = {
      id: "1",
      mbid: "abc-123",
      foreignArtistId: "abc-123",
      artistName: "Test",
      monitored: true,
      monitorOption: "all",
      addedAt: "2024-01-01T00:00:00Z",
      statistics: { albumCount: 5, trackCount: 50, sizeOnDisk: 1000 },
    };
    expect(artist.id).toBe("1");
    expect(artist.statistics.albumCount).toBe(5);
  });

  it("Album type has correct shape", () => {
    const album: Album = {
      id: "1",
      artistId: "1",
      artistName: "Test",
      mbid: "def-456",
      foreignAlbumId: "def-456",
      albumName: "Album",
      title: "Album",
      releaseDate: "2024-06-01",
      monitored: true,
      statistics: { trackCount: 12, sizeOnDisk: 500, percentOfTracks: 100 },
    };
    expect(album.albumName).toBe("Album");
    expect(album.statistics.percentOfTracks).toBe(100);
  });

  it("Track type has correct shape", () => {
    const track: Track = {
      id: "track-1",
      mbid: "track-1",
      trackName: "Song",
      title: "Song",
      trackNumber: 1,
      hasFile: true,
      size: 5000,
      quality: "FLAC",
    };
    expect(track.hasFile).toBe(true);
    expect(track.quality).toBe("FLAC");
  });

  it("Track quality can be null", () => {
    const track: Track = {
      id: "track-2",
      mbid: "track-2",
      trackName: "Song 2",
      title: "Song 2",
      trackNumber: 2,
      hasFile: false,
      size: 0,
      quality: null,
    };
    expect(track.quality).toBeNull();
  });

  it("CoverArtType accepts artist and album", () => {
    const artist: CoverArtType = "artist";
    const album: CoverArtType = "album";
    expect(artist).toBe("artist");
    expect(album).toBe("album");
  });

  it("CoverArtResponse has images array", () => {
    const response: CoverArtResponse = {
      images: [
        { image: "https://img.com/1.jpg", front: true },
        { image: "https://img.com/2.jpg", front: false },
      ],
    };
    expect(response.images).toHaveLength(2);
    expect(response.images[0].front).toBe(true);
  });
});
