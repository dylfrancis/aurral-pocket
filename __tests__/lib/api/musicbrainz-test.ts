import {
  lookupRecordingsByIsrc,
  MusicBrainzUnavailableError,
} from "@/lib/api/musicbrainz";

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

function reply(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe("lookupRecordingsByIsrc", () => {
  it("returns every recording under the ISRC with the artists it credits, once each", async () => {
    mockFetch.mockResolvedValue(
      reply(200, {
        recordings: [
          {
            id: "rec-unholy",
            title: "Unholy",
            "artist-credit": [
              { joinphrase: " & ", artist: { id: "sam", name: "Sam Smith" } },
              { artist: { id: "kim", name: "Kim Petras" } },
              { artist: { id: "sam", name: "Sam Smith" } },
            ],
          },
          {
            id: "rec-chapter",
            title: "Chapter 17",
            "artist-credit": [
              { artist: { id: "austen", name: "Jane Austen" } },
            ],
          },
        ],
      }),
    );

    await expect(lookupRecordingsByIsrc("GBUM72205415")).resolves.toEqual([
      {
        mbid: "rec-unholy",
        title: "Unholy",
        artists: [
          { mbid: "sam", name: "Sam Smith" },
          { mbid: "kim", name: "Kim Petras" },
        ],
      },
      {
        mbid: "rec-chapter",
        title: "Chapter 17",
        artists: [{ mbid: "austen", name: "Jane Austen" }],
      },
    ]);
  });

  it("reads an ISRC MusicBrainz doesn't know as a miss", async () => {
    mockFetch.mockResolvedValue(reply(404));
    await expect(lookupRecordingsByIsrc("XX0000000000")).resolves.toEqual([]);
  });

  it("throws on a busy reply, so the lookup is retried rather than missed", async () => {
    mockFetch.mockResolvedValue(reply(503));
    await expect(lookupRecordingsByIsrc("GBUM72205415")).rejects.toBeInstanceOf(
      MusicBrainzUnavailableError,
    );
  });
});
