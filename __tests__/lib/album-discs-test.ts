import { discHeadings, placeOnEdition, sortByDisc } from "@/lib/album-discs";
import type { Track } from "@/lib/types/library";

describe("sortByDisc", () => {
  it("orders by disc, then number, with unnumbered tracks ending their disc", () => {
    const tracks = [
      { id: "2-1", discNumber: 2, trackNumber: 1 },
      { id: "1-?", discNumber: 1, trackNumber: 0 },
      { id: "1-2", discNumber: 1, trackNumber: 2 },
      // A saved track from before discs were read counts as disc 1.
      { id: "1-1", trackNumber: 1 },
    ];

    expect(sortByDisc(tracks).map((track) => track.id)).toEqual([
      "1-1",
      "1-2",
      "1-?",
      "2-1",
    ]);
  });
});

describe("placeOnEdition", () => {
  const track = (id: string, mbid: string, trackNumber: number) =>
    ({
      id,
      mbid,
      trackName: id,
      title: id,
      trackNumber,
      discNumber: 1,
      hasFile: true,
      size: 1,
      quality: null,
    }) satisfies Track;
  const place = (id: string, discNumber: number, trackNumber: number) => ({
    id,
    title: id,
    discNumber,
    trackNumber,
    length: null,
    popular: false,
  });

  it("keeps the Library's place for what the edition doesn't place", () => {
    const placed = placeOnEdition(
      [
        track("a", "rec-a", 1),
        track("copy", "rec-a", 2),
        track("bonus", "rec-bonus", 3),
        track("unnumbered", "rec-b", 9),
      ],
      [place("rec-a", 2, 1), place("rec-b", 1, 0)],
    );

    expect(
      placed.map(({ id, discNumber, trackNumber }) => [
        id,
        discNumber,
        trackNumber,
      ]),
    ).toEqual([
      // The first copy of a recording takes its place, and a second stays
      // where the Library has it.
      ["copy", 1, 2],
      ["bonus", 1, 3],
      // The edition gives no number, so the Library's stands.
      ["unnumbered", 1, 9],
      ["a", 2, 1],
    ]);
  });
});

describe("discHeadings", () => {
  it.each([
    {
      name: "gives a one-disc album none, whatever it's called",
      rows: [
        { disc: 1, musicBrainzTitle: "Dawn to Dusk" },
        { disc: 1, musicBrainzTitle: "Dawn to Dusk" },
      ],
      headings: [null, null],
    },
    {
      name: "heads each disc once, with MusicBrainz's title",
      rows: [
        { disc: 1, musicBrainzTitle: "Dawn to Dusk" },
        { disc: 1, musicBrainzTitle: "Dawn to Dusk" },
        { disc: 2, musicBrainzTitle: "Twilight to Starlight" },
      ],
      headings: [
        "Disc 1 · Dawn to Dusk",
        null,
        "Disc 2 · Twilight to Starlight",
      ],
    },
    {
      name: "prefers the file's tag, and leaves an untitled disc bare",
      rows: [
        { disc: 1, tagTitle: "Dawn", musicBrainzTitle: "Dawn to Dusk" },
        // A wanted track has no file, so no tag.
        { disc: 1, musicBrainzTitle: "Dawn to Dusk" },
        { disc: 2 },
      ],
      headings: ["Disc 1 · Dawn", null, "Disc 2"],
    },
    {
      name: "drops a title the disc's tracks disagree on",
      rows: [
        { disc: 1, tagTitle: "Side A" },
        { disc: 1, tagTitle: "Side B", musicBrainzTitle: "Dawn to Dusk" },
        { disc: 2 },
      ],
      headings: ["Disc 1 · Dawn to Dusk", null, "Disc 2"],
    },
  ])("$name", ({ rows, headings }) => {
    expect(discHeadings(rows)).toEqual(headings);
  });
});
