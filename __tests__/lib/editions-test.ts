import { editionRows } from "@/lib/editions";
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
        },
      ],
      [liveAirbag],
    );

    expect(rows[0].libraryTrack).toBeNull();
    expect(extras).toEqual([liveAirbag]);
  });
});
