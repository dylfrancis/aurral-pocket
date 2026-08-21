import {
  LIBRARY_READ,
  READS_CANONICAL,
  libraryAlbumsRef,
  libraryTracksRef,
} from "@/lib/library-read";

describe("LIBRARY_READ", () => {
  it("reads the canonical library across every source", () => {
    expect(LIBRARY_READ).toEqual({ readPath: "canonical", source: "all" });
    expect(READS_CANONICAL).toBe(true);
  });
});

describe("libraryAlbumsRef on the canonical read path", () => {
  it("prefers the MBID, which is the only id both read paths share", () => {
    expect(libraryAlbumsRef({ artistId: "42", artistMbid: "mb-1" })).toBe(
      "mb-1",
    );
  });

  it("falls back to the artist id when there is no MBID", () => {
    expect(libraryAlbumsRef({ artistId: "42" })).toBe("42");
  });

  it("returns undefined when neither id is known", () => {
    expect(libraryAlbumsRef({})).toBeUndefined();
  });

  it("ignores an empty MBID", () => {
    expect(libraryAlbumsRef({ artistId: "42", artistMbid: "" })).toBe("42");
  });
});

describe("libraryTracksRef on the canonical read path", () => {
  it("prefers the album MBID", () => {
    expect(libraryTracksRef({ albumId: "7", albumMbid: "mb-album" })).toBe(
      "mb-album",
    );
  });

  it("falls back to the album id, which the canonical route also matches", () => {
    expect(libraryTracksRef({ albumId: "7" })).toBe("7");
  });

  it("returns undefined when neither id is known", () => {
    expect(libraryTracksRef({})).toBeUndefined();
  });
});
