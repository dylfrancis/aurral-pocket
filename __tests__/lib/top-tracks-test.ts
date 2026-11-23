import { matchTopTracks } from "@/lib/top-tracks";
import type { LibraryQueueTrack, PreviewTrack } from "@/lib/types/library";

const preview = (
  title: string,
  album: string | null = null,
  ids: Pick<PreviewTrack, "trackMbid" | "albumMbid"> = {},
): PreviewTrack => ({
  id: `dz-${title}`,
  title,
  album,
  preview_url: "/api/deezer/preview/1.mp3",
  duration_ms: 30_000,
  ...ids,
});

const libraryTrack = (
  id: string,
  title: string,
  album: string,
  ids: Pick<LibraryQueueTrack, "trackMbid" | "albumMbid"> = {
    trackMbid: null,
    albumMbid: null,
  },
): LibraryQueueTrack => ({
  id,
  title,
  artist: "Radiohead",
  album,
  streamPath: `/library/stream/1/${id}`,
  streamFormat: "flac",
  quality: null,
  durationMs: null,
  artistMbid: null,
  libraryTrackId: Number(id),
  libraryAlbumId: 1,
  libraryArtistId: 1,
  artworkUrl: null,
  artworkSource: "album",
  ...ids,
});

// In album order, as the artist queue lists them.
const LIBRARY = [
  libraryTrack("1", "Creep", "Pablo Honey"),
  libraryTrack("2", "Creep (Acoustic)", "My Iron Lung"),
  libraryTrack("3", "Karma Police", "OK Computer"),
  libraryTrack("4", "Karma Police", "OK Computer OKNOTOK 1997 2017"),
  libraryTrack("5", "Café Paranoïa", "Made Up"),
];

describe("matchTopTracks", () => {
  it.each([
    ["the same title", preview("Creep"), "1"],
    [
      "a title that differs in case, accents and punctuation",
      preview("cafe paranoia!"),
      "5",
    ],
    ["a title with a version note", preview("Karma Police (Remastered)"), "3"],
    [
      "a title with a version suffix",
      preview("Karma Police - 2017 Remaster"),
      "3",
    ],
    [
      "the copy on the same album when titles repeat",
      preview("Karma Police", "OK Computer OKNOTOK 1997 2017"),
      "4",
    ],
    [
      "the earliest album when no album matches",
      preview("Karma Police", "Live at Glastonbury"),
      "3",
    ],
    ["an exact title before a looser one", preview("Creep (Acoustic)"), "2"],
  ])("finds %s", (_case, topTrack, libraryId) => {
    expect(matchTopTracks([topTrack], LIBRARY)[0].library?.id).toBe(libraryId);
  });

  it("finds the Library's copy of the same recording, whatever its title", () => {
    const library = [
      ...LIBRARY,
      libraryTrack("6", "Creep (2008 Remaster)", "Pablo Honey", {
        trackMbid: "rec-creep",
        albumMbid: "rg-pablo",
      }),
    ];

    expect(
      matchTopTracks(
        [preview("Creep", null, { trackMbid: "rec-creep" })],
        library,
      )[0].library?.id,
    ).toBe("6");
  });

  it("prefers the copy of a recording on the top track's album", () => {
    const library = [
      libraryTrack("7", "Lucky", "OK Computer", {
        trackMbid: "rec-lucky",
        albumMbid: "rg-ok",
      }),
      libraryTrack("8", "Lucky", "OK Computer OKNOTOK", {
        trackMbid: "rec-lucky",
        albumMbid: "rg-oknotok",
      }),
    ];

    expect(
      matchTopTracks(
        [
          preview("Lucky", null, {
            trackMbid: "rec-lucky",
            albumMbid: "rg-oknotok",
          }),
        ],
        library,
      )[0].library?.id,
    ).toBe("8");
  });

  it("matches by title when the Library's copy has no recording MBID", () => {
    expect(
      matchTopTracks(
        [preview("Creep", null, { trackMbid: "rec-creep" })],
        LIBRARY,
      )[0].library?.id,
    ).toBe("1");
  });

  it("leaves a song the Library doesn't have as a clip", () => {
    expect(
      matchTopTracks([preview("No Surprises")], LIBRARY)[0].library,
    ).toBeNull();
  });

  it("keeps the top tracks' order", () => {
    const matched = matchTopTracks(
      [preview("Karma Police"), preview("No Surprises"), preview("Creep")],
      LIBRARY,
    );
    expect(matched.map((topTrack) => topTrack.preview.title)).toEqual([
      "Karma Police",
      "No Surprises",
      "Creep",
    ]);
  });
});
