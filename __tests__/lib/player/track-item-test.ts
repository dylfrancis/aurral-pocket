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
import {
  jobToPlayerTrack,
  toPlayerTrack,
  type PlaybackCollection,
} from "@/lib/player/track-item";
import type { FlowJob } from "@/lib/types/flow";
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
    bitrateKbps: 1042,
    available: true,
    ...overrides,
  };
}

const album = {
  albumTitle: "Kid A",
  artistName: "Radiohead",
  coverPath: null,
  artworkUrl: "https://art.example/kid-a.jpg",
  albumMbid: "album-mb-1",
  artistMbid: "artist-mb-1",
  albumRef: "canonical-album-12",
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
      // Kept so a restored queue can build a fresh URL for the track.
      streamPath: "/library/canonical-stream/12/77",
      coverPath: null,
      artwork: "https://art.example/kid-a.jpg",
      // Carried on the track so a reported play names the right recording.
      trackMbid: "mb-track",
      artistMbid: "artist-mb-1",
      albumMbid: "album-mb-1",
      favorite: null,
      albumRef: "canonical-album-12",
      audioFormat: "FLAC",
      bitrateKbps: 1042,
    });
  });

  it("carries the key the favorites API addresses the track by", () => {
    const item = toPlayerTrack(
      { ...track(), identityKey: "recording:mb-track" },
      album,
    );

    expect(item?.favorite).toEqual({ kind: "song", key: "recording:mb-track" });
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
      coverPath: null,
      artworkUrl: null,
      albumMbid: null,
      artistMbid: null,
    });

    expect(mapped).toMatchObject({
      artist: "Unknown Artist",
      album: "Unknown Album",
      artwork: null,
    });
  });
});

describe("jobToPlayerTrack", () => {
  const job: FlowJob = {
    id: "job-1",
    // A shared playlist can hold a track its source flow downloaded.
    playlistType: "flow-9",
    artistName: "Slowdive",
    trackName: "Alison",
    albumName: "Souvlaki",
    artistMbid: "artist-mb",
    albumMbid: "album-mb",
    trackMbid: "track-mb",
    status: "done",
    qualityFormat: "m4a",
    qualityBitrateKbps: 256,
    streamFormat: "m4a",
  };
  const playlist: PlaybackCollection = {
    kind: "shared",
    id: "pl-1",
    name: "Road Trip",
    recordHistory: false,
    artworkRevision: 7,
  };

  it("gives the track its own artist and album, and not the playlist's cover", () => {
    expect(jobToPlayerTrack(job, playlist)).toEqual({
      id: "job-1",
      title: "Alison",
      artist: "Slowdive",
      album: "Souvlaki",
      duration: 0,
      url: "https://test.example/api/playlists/stream/job-1?token=test-token-123",
      artwork: null,
      streamPath: "/playlists/stream/job-1",
      coverPath: null,
      trackMbid: "track-mb",
      artistMbid: "artist-mb",
      albumMbid: "album-mb",
      favorite: { kind: "shared-song", key: "pl-1:job-1" },
      // The server's lossy "m4a" family is AAC.
      audioFormat: "AAC",
      bitrateKbps: 256,
      recordHistory: false,
    });
  });

  it("addresses a flow's own track as a flow song", () => {
    expect(
      jobToPlayerTrack(job, { ...playlist, kind: "flow" })?.favorite,
    ).toEqual({ kind: "flow-song", key: "pl-1:job-1" });
  });

  it("carries its album's cover once it's known", () => {
    const cover = "https://img.example/souvlaki.jpg";

    expect(jobToPlayerTrack(job, playlist, cover)?.artwork).toBe(cover);
  });

  it("loads artwork uploaded for the track first", () => {
    const artworkUrl = "/api/playlists/track-artwork/job-1?v=3";

    expect(jobToPlayerTrack({ ...job, artworkUrl }, playlist)?.coverPath).toBe(
      artworkUrl,
    );
  });

  it("leaves the album empty when the job has none", () => {
    expect(jobToPlayerTrack({ ...job, albumName: null }, playlist)?.album).toBe(
      "",
    );
  });

  it.each(["pending", "downloading", "blocked", "failed"] as const)(
    "doesn't play a %s job",
    (status) => {
      expect(jobToPlayerTrack({ ...job, status }, playlist)).toBeNull();
    },
  );
});
