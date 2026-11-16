import { activeLineIndex, lyricsLookupFor } from "@/lib/player/lyrics";
import type { PlayerTrack } from "@/lib/player/track-item";

const libraryTrack: PlayerTrack = {
  id: "7",
  title: "Kid A",
  artist: "Radiohead",
  album: "Kid A",
  duration: 0,
  url: "https://test.example/api/library/stream/4/7",
  artwork: null,
  streamPath: "/library/stream/4/7",
  coverPath: null,
  trackMbid: null,
  artistMbid: null,
  albumMbid: null,
  favorite: null,
};

describe("lyricsLookupFor", () => {
  it("sends a Library track's album and track ids, so Aurral can read the file's own lyrics", () => {
    expect(lyricsLookupFor(libraryTrack)).toEqual({
      artist: "Radiohead",
      title: "Kid A",
      album: "Kid A",
      libraryAlbumId: "4",
      libraryTrackId: "7",
    });
  });

  it("asks by name alone for a playlist download, and leaves off an empty album", () => {
    expect(
      lyricsLookupFor({
        ...libraryTrack,
        album: "",
        streamPath: "/playlists/stream/job-1",
      }),
    ).toEqual({ artist: "Radiohead", title: "Kid A" });
  });

  it.each([
    ["a search preview clip", { streamPath: null }],
    ["a saved job's remote preview", { isPreview: true }],
  ])("asks nothing for %s, whose times don't match the song", (_, change) => {
    expect(lyricsLookupFor({ ...libraryTrack, ...change })).toBeNull();
  });
});

describe("activeLineIndex", () => {
  const lines = [
    { start: 10_000, value: "first" },
    { start: 15_000, value: "" },
    { start: 20_000, value: "second" },
  ];

  it.each([
    [9_999, -1],
    [10_000, 0],
    [17_500, 1],
    [600_000, 2],
  ])("at %i ms marks line %i", (positionMs, expected) => {
    expect(activeLineIndex(lines, positionMs)).toBe(expected);
  });
});
