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
import { pause, playItem, playTrack, resume } from "@/lib/player/player";
import type { Track } from "@/lib/types/library";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";

const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;

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
};

const clip = {
  id: "preview-9",
  title: "Idioteque",
  artist: "Radiohead",
  album: "Kid A",
  duration: 0,
  url: "https://preview.example/9.mp3",
  artwork: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  setBaseUrl("https://test.example");
  setAuthToken("test-token-123");
  queue.createPlaylist.mockResolvedValue("playlist-1");
});

describe("playTrack", () => {
  it("plays the track the engine was handed", async () => {
    await expect(playTrack(track(), album)).resolves.toBe(true);

    // The notification is what drives the lock screen and headset buttons.
    expect(player.configure).toHaveBeenCalledWith(
      expect.objectContaining({ showInNotification: true }),
    );
    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-1", [
      {
        id: "77",
        title: "Everything In Its Right Place",
        artist: "Radiohead",
        album: "Kid A",
        duration: 0,
        url: "https://test.example/api/library/canonical-stream/12/77?token=test-token-123",
        artwork: "https://art.example/kid-a.jpg",
      },
    ]);
    expect(queue.loadPlaylist).toHaveBeenCalledWith("playlist-1");
    expect(player.playSong).toHaveBeenCalledWith("77", "playlist-1");
    // playSong only cues: the engine starts audio only when something was
    // already playing. Without this call the track sits silent on the lock
    // screen until the user presses play there.
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("leaves the engine alone when Aurral cannot stream the track", async () => {
    await expect(playTrack(track({ streamPath: null }), album)).resolves.toBe(
      false,
    );

    expect(player.playSong).not.toHaveBeenCalled();
    expect(queue.createPlaylist).not.toHaveBeenCalled();
  });
});

describe("playItem", () => {
  it("plays a preview clip through the same engine", async () => {
    await playItem(clip);

    expect(queue.addTracksToPlaylist).toHaveBeenCalledWith("playlist-1", [
      clip,
    ]);
    expect(player.playSong).toHaveBeenCalledWith("preview-9", "playlist-1");
  });

  it("keeps rapid plays in order, so the last tap wins", async () => {
    // Taps are not awaited by the UI. Without serialization two overlapping
    // plays interleave: one adds its track to the other's playlist, or plays
    // against a playlist that was just deleted — and the first tap can finish
    // last, ending playback on the wrong track.
    let resolveFirst!: (id: string) => void;
    queue.createPlaylist
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce("playlist-2");

    const first = playItem(clip);
    const second = playItem({ ...clip, id: "clip-2" });
    await new Promise((resolve) => setImmediate(resolve));
    resolveFirst("playlist-1");
    await Promise.all([first, second]);

    expect(queue.addTracksToPlaylist).toHaveBeenNthCalledWith(1, "playlist-1", [
      expect.objectContaining({ id: "preview-9" }),
    ]);
    expect(queue.addTracksToPlaylist).toHaveBeenNthCalledWith(2, "playlist-2", [
      expect.objectContaining({ id: "clip-2" }),
    ]);
    expect(player.playSong).toHaveBeenLastCalledWith("clip-2", "playlist-2");
  });

  it("replaces what is playing rather than stacking playlists", async () => {
    // One engine holds one thing, so a clip and a library track cannot sound
    // at the same time. Starting either one ends the other.
    await playItem(clip);
    queue.createPlaylist.mockResolvedValue("playlist-2");

    await playTrack(track(), album);

    expect(queue.deletePlaylist).toHaveBeenCalledWith("playlist-1");
    expect(player.playSong).toHaveBeenLastCalledWith("77", "playlist-2");
  });
});

describe("transport", () => {
  it("pauses the engine", async () => {
    await pause();

    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it("resumes the engine", async () => {
    await resume();

    expect(player.play).toHaveBeenCalledTimes(1);
  });
});
