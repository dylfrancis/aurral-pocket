import {
  bestMatch,
  siriAsk,
  type SiriAsk,
  type SiriCandidate,
} from "@/lib/siri/match";
import type { SiriSearch } from "@/modules/siri";

function search(overrides: Partial<SiriSearch> = {}): SiriSearch {
  return {
    mediaType: "unknown",
    genres: [],
    mine: false,
    suggested: [],
    ...overrides,
  };
}

function queryOf(ask: SiriAsk) {
  if (ask.ask !== "query") throw new Error(`expected a query, got ${ask.ask}`);
  return ask.query;
}

describe("siriAsk", () => {
  it("leaves out podcasts, audiobooks and video", () => {
    expect(siriAsk(search({ mediaType: "other", name: "Serial" }))).toEqual({
      ask: "unsupported",
    });
  });

  it("reads a request that names nothing as anything", () => {
    expect(siriAsk(search({ mediaType: "music" }))).toEqual({
      ask: "anything",
      radio: false,
    });
  });

  // Siri often leaves the whole phrase as the name, and the server matches a
  // title or an artist, never both in one search.
  it("searches the title alone when Siri leaves 'by' in the name", () => {
    const query = queryOf(siriAsk(search({ name: "Kid A by Radiohead" })));

    expect(query.searches).toEqual(["Kid A by Radiohead", "Kid A"]);
    expect(query.words).toEqual(["kid", "a", "radiohead"]);
  });

  it("looks only for the artist when the artist is all Siri heard", () => {
    const query = queryOf(
      siriAsk(search({ mediaType: "music", artist: "Radiohead" })),
    );

    expect(query.kinds).toEqual(["artist"]);
    expect(query.searches).toEqual(["Radiohead"]);
  });

  it("looks only for the genre when a genre is all Siri heard", () => {
    const query = queryOf(siriAsk(search({ genres: ["Rock"] })));

    expect(query.kinds).toEqual(["genre"]);
  });

  // Siri answered "I couldn't find pop in Aurral in Aurral".
  it("drops the app's name when Siri leaves it in what it heard", () => {
    const query = queryOf(siriAsk(search({ name: "pop in Aurral" })));

    expect(query.searches).toEqual(["pop"]);
    expect(query.words).toEqual(["pop"]);
  });

  it("reads the app's name alone as anything", () => {
    expect(siriAsk(search({ name: "Aurral" }))).toEqual({
      ask: "anything",
      radio: false,
    });
  });

  it.each<[string, Partial<SiriSearch>]>([
    ["the request ends in 'radio'", { name: "Radiohead radio" }],
    ["it ends in 'station'", { name: "Radiohead station" }],
    ["Siri names a station", { mediaType: "station", artist: "Radiohead" }],
  ])("asks for a station when %s", (_, heard) => {
    const query = queryOf(siriAsk(search(heard)));

    expect(query.radio).toBe(true);
    expect(query.words).toEqual(["radiohead"]);
  });

  it("asks for Your Radio when radio is all Siri heard", () => {
    expect(siriAsk(search({ name: "radio" }))).toEqual({
      ask: "anything",
      radio: true,
    });
  });

  it("keeps a title that only starts with 'radio'", () => {
    const query = queryOf(siriAsk(search({ name: "Radio Ga Ga" })));

    expect(query.radio).toBe(false);
    expect(query.words).toEqual(["radio", "ga", "ga"]);
  });

  it("falls back to Siri's own guess when it sent no name", () => {
    const query = queryOf(
      siriAsk(
        search({
          suggested: [{ type: "song", title: "Creep", artist: "Radiohead" }],
        }),
      ),
    );

    expect(query.searches).toEqual(["Creep"]);
    expect(query.words).toEqual(["creep", "radiohead"]);
  });
});

describe("bestMatch", () => {
  const library: SiriCandidate<string>[] = [
    { kind: "artist", title: "Radiohead", value: "artist:radiohead" },
    { kind: "artist", title: "Weezer", value: "artist:weezer" },
    {
      kind: "album",
      title: "Weezer",
      artist: "Weezer",
      value: "album:weezer",
    },
    {
      kind: "album",
      title: "Kid A",
      artist: "Radiohead",
      value: "album:kid-a",
    },
    {
      kind: "song",
      title: "Kid A",
      artist: "Radiohead",
      value: "song:kid-a",
    },
    {
      kind: "song",
      title: "Creep (Acoustic)",
      artist: "Radiohead",
      value: "song:creep-acoustic",
    },
    {
      kind: "song",
      title: "Creep",
      artist: "Radiohead",
      value: "song:creep",
    },
    {
      kind: "album",
      title: "Ágætis byrjun",
      artist: "Sigur Rós",
      value: "album:agaetis",
    },
    {
      kind: "song",
      title: "The Sound of Silence",
      artist: "Simon & Garfunkel",
      value: "song:silence",
    },
    { kind: "genre", title: "Rock", value: "genre:rock" },
  ];

  const play = (overrides: Partial<SiriSearch>) => {
    const ask = siriAsk(search(overrides));
    return ask.ask === "query"
      ? (bestMatch(ask.query, library)?.value ?? null)
      : null;
  };

  it.each<[string, Partial<SiriSearch>, string]>([
    ["the exact title over a longer one", { name: "Creep" }, "song:creep"],
    [
      "the artist, when only the artist was said",
      { name: "Radiohead" },
      "artist:radiohead",
    ],
    [
      "the artist over a self-titled album",
      { name: "Weezer" },
      "artist:weezer",
    ],
    [
      "the album over its title track",
      { name: "Kid A by Radiohead" },
      "album:kid-a",
    ],
    ["a title heard as two words", { name: "Radio head" }, "artist:radiohead"],
    [
      "a title without its accents",
      { name: "agaetis byrjun" },
      "album:agaetis",
    ],
    [
      "'and' for an ampersand",
      { name: "sound of silence simon and garfunkel" },
      "song:silence",
    ],
    ["the kind Siri named", { mediaType: "song", name: "Kid A" }, "song:kid-a"],
    [
      "the artist, for songs by them",
      { mediaType: "song", artist: "Radiohead" },
      "artist:radiohead",
    ],
    ["a genre", { genres: ["rock"] }, "genre:rock"],
    ["a genre named with the app", { name: "rock in Aurral" }, "genre:rock"],
  ])("plays %s", (_, heard, expected) => {
    expect(play(heard)).toBe(expected);
  });

  it.each<[string, Partial<SiriSearch>]>([
    [
      "too few of the words heard match",
      { name: "the moon and the stars kid" },
    ],
    [
      "the words match only an artist",
      { mediaType: "album", name: "Radiohead" },
    ],
    [
      "the kind Siri named has no match",
      { mediaType: "playlist", name: "Creep" },
    ],
  ])("plays nothing when %s", (_, heard) => {
    expect(play(heard)).toBeNull();
  });
});
