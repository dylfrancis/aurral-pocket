import { libraryAlbumsRef, libraryTracksRef } from "@/lib/library-read";

describe("libraryAlbumsRef", () => {
  it("prefers the MBID, the id the artist detail and the canonical library share", () => {
    expect(libraryAlbumsRef({ artistId: "42", artistMbid: "mb-1" })).toBe(
      "mb-1",
    );
  });

  it("falls back to the artist id when there is no MBID", () => {
    // A file-scanned artist has no MBID. The library list navigates by its
    // canonical id, which arrives in the artistId position.
    expect(libraryAlbumsRef({ artistId: "8" })).toBe("8");
  });

  it("ignores an empty MBID", () => {
    expect(libraryAlbumsRef({ artistId: "8", artistMbid: "" })).toBe("8");
  });

  it("returns undefined when neither id is known", () => {
    expect(libraryAlbumsRef({})).toBeUndefined();
  });
});

describe("libraryTracksRef", () => {
  it("prefers the canonical album id, the only id the paged route matches", () => {
    expect(
      libraryTracksRef({
        albumId: "7",
        albumMbid: "mb-album",
        canonicalAlbumId: "c-7",
      }),
    ).toBe("c-7");
  });

  it("falls back to the MBID when the canonical id is unknown", () => {
    // The paged route cannot match an MBID, so this read returns an empty
    // track list instead of the album. It degrades a caller that skipped
    // the canonical id; it does not crash it.
    expect(libraryTracksRef({ albumId: "7", albumMbid: "mb-album" })).toBe(
      "mb-album",
    );
  });

  it("falls back to the album id when nothing else is known", () => {
    expect(libraryTracksRef({ albumId: "7" })).toBe("7");
  });

  it("returns undefined when no id is known", () => {
    expect(libraryTracksRef({})).toBeUndefined();
  });
});
