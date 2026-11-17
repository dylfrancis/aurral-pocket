import { radioSeedFor } from "@/lib/player/radio";
import type { PlayerTrack } from "@/lib/player/track-item";

function queued(overrides: Partial<PlayerTrack>): PlayerTrack {
  return {
    id: "1",
    title: "Idioteque",
    artist: "Radiohead",
    album: "Kid A",
    duration: 0,
    url: "https://test.example/stream",
    artwork: null,
    streamPath: null,
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
    favorite: null,
    ...overrides,
  };
}

describe("radioSeedFor", () => {
  it.each([
    {
      case: "a Library track by its Library id, once",
      items: [
        queued({ streamPath: "/library/stream/12/77" }),
        queued({ streamPath: "/library/stream/40/77" }),
      ],
      seed: { trackIds: ["77"], artists: [] },
    },
    {
      case: "playlist jobs by their artist, once",
      items: [
        queued({
          streamPath: "/playlists/stream/job-1",
          artist: "Massive Attack",
          artistMbid: "mb-massive",
        }),
        queued({
          streamPath: "/playlists/stream/job-3",
          artist: "Massive Attack",
          artistMbid: "mb-massive",
        }),
      ],
      seed: {
        trackIds: [],
        artists: [{ mbid: "mb-massive", name: "Massive Attack" }],
      },
    },
    {
      case: "nothing for a job with no artist to follow",
      items: [queued({ streamPath: "/playlists/stream/job-2", artist: "" })],
      seed: { trackIds: [], artists: [] },
    },
  ])("seeds $case", ({ items, seed }) => {
    expect(radioSeedFor(items)).toEqual(seed);
  });
});
