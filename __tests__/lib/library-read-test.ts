import {
  LIBRARY_READ,
  READS_CANONICAL,
  libraryAlbumsRef,
  libraryTracksRef,
  resolveAlbumsRef,
  resolveTracksRef,
} from "@/lib/library-read";

describe("LIBRARY_READ", () => {
  // The canonical library is built from media files, so it omits the wanted
  // records the library screens show: a new artist with no files, an album
  // that is still downloading, a track with no file. The screens stay on the
  // legacy path until the server can return those too. See issue #199.
  it("keeps the library screens on the legacy read path", () => {
    expect(LIBRARY_READ).toEqual({});
    expect(READS_CANONICAL).toBe(false);
  });

  it("addresses records by their Lidarr id while the legacy path is active", () => {
    expect(libraryAlbumsRef({ artistId: "42", artistMbid: "mb-1" })).toBe("42");
    expect(libraryTracksRef({ albumId: "7", albumMbid: "mb-album" })).toBe("7");
  });
});

describe("resolveAlbumsRef on the legacy read path", () => {
  it("uses the Lidarr artist id, which is the only id Lidarr matches", () => {
    expect(
      resolveAlbumsRef(false, { artistId: "42", artistMbid: "mb-1" }),
    ).toBe("42");
  });

  it("returns undefined when the Lidarr id is unknown", () => {
    expect(resolveAlbumsRef(false, { artistMbid: "mb-1" })).toBeUndefined();
  });
});

describe("resolveAlbumsRef on the canonical read path", () => {
  it("prefers the MBID, the only id both read paths share", () => {
    expect(resolveAlbumsRef(true, { artistId: "42", artistMbid: "mb-1" })).toBe(
      "mb-1",
    );
  });

  it("falls back to the artist id when there is no MBID", () => {
    expect(resolveAlbumsRef(true, { artistId: "42" })).toBe("42");
  });

  it("ignores an empty MBID", () => {
    expect(resolveAlbumsRef(true, { artistId: "42", artistMbid: "" })).toBe(
      "42",
    );
  });

  it("returns undefined when neither id is known", () => {
    expect(resolveAlbumsRef(true, {})).toBeUndefined();
  });
});

describe("resolveTracksRef on the legacy read path", () => {
  it("uses the Lidarr album id", () => {
    expect(
      resolveTracksRef(false, {
        albumId: "7",
        albumMbid: "mb-album",
        canonicalAlbumId: "c-7",
      }),
    ).toBe("7");
  });
});

describe("resolveTracksRef on the canonical read path", () => {
  it("prefers the album MBID", () => {
    expect(
      resolveTracksRef(true, { albumId: "7", albumMbid: "mb-album" }),
    ).toBe("mb-album");
  });

  it("falls back to the canonical album id, which a Lidarr id cannot match", () => {
    expect(
      resolveTracksRef(true, { albumId: "7", canonicalAlbumId: "c-7" }),
    ).toBe("c-7");
  });

  it("falls back to the album id when nothing else is known", () => {
    expect(resolveTracksRef(true, { albumId: "7" })).toBe("7");
  });

  it("returns undefined when no id is known", () => {
    expect(resolveTracksRef(true, {})).toBeUndefined();
  });
});
