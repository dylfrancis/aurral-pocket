jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import { toPlayerTrack } from "@/lib/player/track-item";
import type { Track } from "@/lib/types/library";

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: "77",
    mbid: "mb-track",
    trackName: "Everything In Its Right Place",
    title: "Everything In Its Right Place",
    trackNumber: 1,
    hasFile: true,
    size: 9_000_000,
    quality: "FLAC",
    streamPath: "/library/canonical-stream/12/77",
    streamFormat: "flac",
    available: true,
    ...overrides,
  };
}

const album = {
  albumTitle: "Kid A",
  artistName: "Radiohead",
  artworkUrl: "https://art.example/kid-a.jpg",
  artistMbid: "artist-mb-1",
};

beforeEach(() => {
  setBaseUrl("https://test.example");
  setAuthToken("test-token-123");
});

describe("toPlayerTrack", () => {
  it("points the player at the authenticated stream route", () => {
    expect(toPlayerTrack(track(), album)).toEqual({
      id: "77",
      title: "Everything In Its Right Place",
      artist: "Radiohead",
      album: "Kid A",
      duration: 0,
      url: "https://test.example/api/library/canonical-stream/12/77?token=test-token-123",
      artwork: "https://art.example/kid-a.jpg",
    });
  });

  it("refuses a track that Aurral cannot stream", () => {
    // Lidarr owns the file but Aurral cannot read it, so streamPath is null.
    // The row still shows a checkmark. Playback must not start.
    expect(toPlayerTrack(track({ streamPath: null }), album)).toBeNull();
  });

  it("refuses to play once the session is gone", () => {
    setAuthToken(null);

    expect(toPlayerTrack(track(), album)).toBeNull();
  });

  it("names an unknown artist and album rather than showing blanks", () => {
    const mapped = toPlayerTrack(track(), {
      albumTitle: "",
      artistName: "",
      artworkUrl: null,
      artistMbid: null,
    });

    expect(mapped).toMatchObject({
      artist: "Unknown Artist",
      album: "Unknown Album",
      artwork: null,
    });
  });
});
