import { discHeadings, sortByDisc } from "@/lib/album-discs";

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
