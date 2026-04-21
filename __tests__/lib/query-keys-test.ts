import { authKeys, libraryKeys } from "@/lib/query-keys";

describe("authKeys", () => {
  it("generates me key with serverUrl", () => {
    expect(authKeys.me("https://example.com")).toEqual([
      "auth",
      "me",
      "https://example.com",
    ]);
  });
});

describe("libraryKeys", () => {
  it("generates artists key", () => {
    expect(libraryKeys.artists()).toEqual(["library", "artists"]);
  });

  it("generates artist key with mbid", () => {
    expect(libraryKeys.artist("abc-123")).toEqual([
      "library",
      "artist",
      "abc-123",
    ]);
  });

  it("generates albums key with artistId", () => {
    expect(libraryKeys.albums("42")).toEqual(["library", "albums", "42"]);
  });

  it("generates tracks key with albumId", () => {
    expect(libraryKeys.tracks("99")).toEqual(["library", "tracks", "99"]);
  });

  it("generates artistCover key with mbid", () => {
    expect(libraryKeys.artistCover("abc-123")).toEqual([
      "cover",
      "artist",
      "abc-123",
    ]);
  });

  it("generates albumCover key with mbid", () => {
    expect(libraryKeys.albumCover("def-456")).toEqual([
      "cover",
      "album",
      "def-456",
    ]);
  });
});
