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

jest.mock("@/lib/player/player", () => ({
  playAlbumFromTrack: jest.fn(),
}));

import { act, renderHook } from "@testing-library/react-native";
import * as Burnt from "burnt";
import { usePlayTrack } from "@/hooks/library/use-play-track";
import { playAlbumFromTrack } from "@/lib/player/player";
import type { Track } from "@/lib/types/library";

const mockPlayAlbumFromTrack = playAlbumFromTrack as jest.MockedFunction<
  typeof playAlbumFromTrack
>;
const mockToast = Burnt.toast as jest.Mock;

const TRACK: Track = {
  id: "77",
  mbid: "mb-track",
  trackName: "Weird Fishes",
  title: "Weird Fishes",
  trackNumber: 4,
  hasFile: true,
  size: 1024,
  quality: "FLAC",
  streamPath: "/library/canonical-stream/12/77",
};

const EARLIER_TRACK: Track = {
  ...TRACK,
  id: "76",
  trackName: "Nude",
  title: "Nude",
  trackNumber: 3,
  streamPath: "/library/canonical-stream/12/76",
};

const ALBUM_TRACKS = [EARLIER_TRACK, TRACK];

const ALBUM = {
  albumTitle: "In Rainbows",
  artistName: "Radiohead",
  artworkUrl: null,
  artistMbid: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("usePlayTrack", () => {
  it("queues the album from the tapped track and says nothing", async () => {
    mockPlayAlbumFromTrack.mockResolvedValue(true);
    const { result } = await renderHook(() => usePlayTrack());

    await act(async () => {
      await result.current(ALBUM_TRACKS, TRACK, ALBUM);
    });

    expect(mockPlayAlbumFromTrack).toHaveBeenCalledWith(
      ALBUM_TRACKS,
      TRACK,
      ALBUM,
    );
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("explains that Aurral has no file for the track", async () => {
    // The row shows a checkmark because Lidarr has the file. Aurral cannot
    // read it, so the tap has to say so rather than do nothing.
    mockPlayAlbumFromTrack.mockResolvedValue(false);
    const { result } = await renderHook(() => usePlayTrack());

    await act(async () => {
      await result.current(ALBUM_TRACKS, { ...TRACK, streamPath: null }, ALBUM);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Cannot play this track",
        message: expect.stringContaining("no file"),
      }),
    );
  });

  it("shows the reason the player failed", async () => {
    mockPlayAlbumFromTrack.mockRejectedValue(new Error("Stream failed: 401"));
    const { result } = await renderHook(() => usePlayTrack());

    await act(async () => {
      await result.current(ALBUM_TRACKS, TRACK, ALBUM);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Playback failed",
        message: "Stream failed: 401",
      }),
    );
  });
});
