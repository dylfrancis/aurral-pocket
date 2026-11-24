import { editionRows, libraryAlbumRows } from "@/lib/editions";
import type { Track } from "@/lib/types/library";

describe("editionRows", () => {
  it("doesn't take a same-titled track from another disc", () => {
    // Scanned without a recording tag, so only its title and place can match.
    const liveAirbag = {
      id: "201",
      mbid: "",
      trackName: "Airbag",
      title: "Airbag",
      trackNumber: 1,
      discNumber: 2,
      hasFile: true,
      size: 1,
      quality: null,
      streamPath: "/library/stream/14/201",
    } satisfies Track;

    const { rows, extras } = editionRows(
      [
        {
          id: "rec-1",
          title: "Airbag",
          trackNumber: 1,
          discNumber: 1,
          length: null,
          popular: false,
        },
      ],
      [liveAirbag],
    );

    expect(rows[0].libraryTrack).toBeNull();
    expect(extras).toEqual([liveAirbag]);
  });
});

describe("libraryAlbumRows", () => {
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

  it("places tracks on the edition, lists what the Library lacks, and keeps the rest where the Library has them", () => {
    const rows = libraryAlbumRows(
      [
        track("a", "rec-a", 1),
        track("copy", "rec-a", 2),
        track("bonus", "rec-bonus", 3),
        track("unnumbered", "rec-b", 9),
      ],
      [place("rec-a", 2, 1), place("rec-b", 1, 0), place("rec-gone", 1, 4)],
    );

    expect(
      rows.map(({ track, missing }) =>
        track
          ? [track.id, track.discNumber, track.trackNumber]
          : [`missing ${missing.id}`],
      ),
    ).toEqual([
      // The first copy of a recording takes its place, and a second stays
      // where the Library has it.
      ["copy", 1, 2],
      ["bonus", 1, 3],
      // Deleted from the Library, so only the edition lists it.
      ["missing rec-gone"],
      // The edition gives no number, so the Library's stands.
      ["unnumbered", 1, 9],
      ["a", 2, 1],
    ]);
  });

  it("lists nothing missing when none of the Library's tracks are on the edition", () => {
    // Files from another edition, whose recordings and titles differ.
    const rows = libraryAlbumRows(
      [track("remaster-2", "rec-r2", 2), track("remaster-1", "rec-r1", 1)],
      [place("rec-1", 1, 1), place("rec-2", 1, 2)],
    );

    expect(rows.map(({ track }) => track?.id)).toEqual([
      "remaster-1",
      "remaster-2",
    ]);
  });
});
