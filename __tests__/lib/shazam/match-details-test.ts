import type { IsrcRecording } from "@/lib/api/musicbrainz";
import {
  artistSearchQuery,
  findLibraryTrack,
  librarySearchQuery,
  pickRecording,
} from "@/lib/shazam/match-details";
import type { LibrarySearchTrack } from "@/lib/types/search";
import type { ShazamMatch } from "@/modules/shazam";

function shazamMatch(title: string, artist: string | null): ShazamMatch {
  return {
    title,
    artist,
    album: null,
    artworkUrl: null,
    appleMusicUrl: null,
    isrc: null,
    shazamId: null,
  };
}

function libraryTrack(
  overrides: Partial<LibrarySearchTrack> = {},
): LibrarySearchTrack {
  return {
    id: "t1",
    title: "Unholy",
    artistName: "Sam Smith",
    albumTitle: "Gloria",
    albumMbid: "rg-gloria",
    albumCanonicalId: "12",
    trackMbid: null,
    artistMbid: null,
    releaseYear: "2023",
    durationMs: 156000,
    streamPath: "/library/canonical-stream/12/t1",
    ...overrides,
  };
}

const NO_LOOKUPS = { recording: null, link: null };

describe("library search query", () => {
  // The server matches the query as one substring of the title, so a
  // featured credit Shazam adds would hide the library's copy.
  it.each([
    ["Unholy (feat. Kim Petras)", "Unholy"],
    ["Blinding Lights [with ROSALÍA]", "Blinding Lights"],
    ["One Dance (ft. Wizkid & Kyla)", "One Dance"],
    ["Song - feat. Someone", "Song"],
    ["Song featuring Someone", "Song"],
    ["Dancing with Myself", "Dancing with Myself"],
    ["Blinding Lights (Remix)", "Blinding Lights (Remix)"],
    ["Feathers", "Feathers"],
  ])("searches %p as %p", (title, query) => {
    expect(librarySearchQuery(shazamMatch(title, null))).toBe(query);
  });
});

describe("artist name-search query", () => {
  it.each([
    ["The Weeknd feat. ROSALÍA", "The Weeknd"],
    ["Calvin Harris (feat. Dua Lipa)", "Calvin Harris"],
    ["Sam Smith & Kim Petras", "Sam Smith & Kim Petras"],
    ["Earth, Wind & Fire", "Earth, Wind & Fire"],
  ])("searches %p as %p", (artist, query) => {
    expect(artistSearchQuery(shazamMatch("Song", artist))).toBe(query);
  });
});

describe("pickRecording", () => {
  // USUM71302939 on MusicBrainz, in either order.
  const theWay: IsrcRecording = {
    mbid: "rec-the-way",
    title: "The Way",
    artists: [
      { mbid: "ariana", name: "Ariana Grande" },
      { mbid: "mac", name: "Mac Miller" },
    ],
  };
  const chapter: IsrcRecording = {
    mbid: "rec-chapter",
    title: "Chapter 17",
    artists: [
      { mbid: "austen", name: "Jane Austen" },
      { mbid: "beckinsale", name: "Kate Beckinsale" },
    ],
  };
  const match = shazamMatch("The Way (feat. Mac Miller)", "Ariana Grande");

  it("takes the matched song over another recording filed under its ISRC", () => {
    expect(pickRecording([chapter, theWay], match)).toBe(theWay);
    expect(pickRecording([theWay, chapter], match)).toBe(theWay);
  });

  it("reads an ISRC that names only other songs as a miss", () => {
    expect(pickRecording([chapter], match)).toBeNull();
  });

  it("takes a recording by the same artist under another title", () => {
    const remaster = { ...theWay, title: "The Way (2023 remaster)" };
    expect(pickRecording([chapter, remaster], match)).toBe(remaster);
  });
});

describe("findLibraryTrack", () => {
  it("matches the recording MBID whatever the titles say", () => {
    const track = libraryTrack({ title: "Unholy - Single", trackMbid: "rec" });
    const found = findLibraryTrack(
      [libraryTrack({ id: "other", title: "Gimme" }), track],
      shazamMatch("Unholy (feat. Kim Petras)", "Sam Smith & Kim Petras"),
      { recording: { mbid: "rec", title: "Unholy", artists: [] }, link: null },
    );
    expect(found).toBe(track);
  });

  it("matches the link's recording MBID when the ISRC missed", () => {
    const track = libraryTrack({ title: "Unholy - Single", trackMbid: "rec" });
    const found = findLibraryTrack(
      [track],
      shazamMatch("Unholy", "Sam Smith & Kim Petras"),
      {
        recording: null,
        link: {
          kind: "track",
          artist: { name: null, mbid: null },
          album: null,
          track: { title: "Unholy", mbid: "rec" },
          source: "appleMusic",
        },
      },
    );
    expect(found).toBe(track);
  });

  it("matches the title and one artist of the credit without an MBID", () => {
    // The library album is credited to Sam Smith alone.
    const track = libraryTrack();
    const found = findLibraryTrack(
      [track],
      shazamMatch("Unholy (feat. Kim Petras)", "Sam Smith & Kim Petras"),
      NO_LOOKUPS,
    );
    expect(found).toBe(track);
  });

  it("matches the album artist by MBID when its name differs", () => {
    const track = libraryTrack({
      title: "Don’t Start Now",
      artistName: "Dua Lipa (UK)",
      artistMbid: "dua",
    });
    const found = findLibraryTrack(
      [track],
      shazamMatch("Don't Start Now", "Dua Lipa"),
      {
        recording: {
          mbid: "other",
          title: "Don't Start Now",
          artists: [{ mbid: "dua", name: "Dua Lipa" }],
        },
        link: null,
      },
    );
    expect(found).toBe(track);
  });

  it("matches across accents, case and punctuation", () => {
    const track = libraryTrack({
      title: "Despacito",
      artistName: "Luis Fonsi",
    });
    const found = findLibraryTrack(
      [track],
      shazamMatch("DESPACITO", "Luís Fonsi"),
      NO_LOOKUPS,
    );
    expect(found).toBe(track);
  });

  it("does not take another version of the song", () => {
    const found = findLibraryTrack(
      [libraryTrack({ title: "Blinding Lights", artistName: "The Weeknd" })],
      shazamMatch("Blinding Lights (Remix)", "The Weeknd & ROSALÍA"),
      NO_LOOKUPS,
    );
    expect(found).toBeNull();
  });

  it("does not take the same title by another artist", () => {
    const found = findLibraryTrack(
      [libraryTrack({ title: "Unholy", artistName: "Unholy Alliance" })],
      shazamMatch("Unholy", "Sam Smith & Kim Petras"),
      NO_LOOKUPS,
    );
    expect(found).toBeNull();
  });

  it("skips a track with no file to play", () => {
    const found = findLibraryTrack(
      [libraryTrack({ trackMbid: "rec", streamPath: null })],
      shazamMatch("Unholy", "Sam Smith"),
      { recording: { mbid: "rec", title: "Unholy", artists: [] }, link: null },
    );
    expect(found).toBeNull();
  });
});
