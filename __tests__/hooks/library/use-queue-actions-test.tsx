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
  addToQueue: jest.fn(),
  playAlbumFromTrack: jest.fn(),
  playNextInQueue: jest.fn(),
  setShuffle: jest.fn(),
}));

import { act, renderHook } from "@testing-library/react-native";
import * as Burnt from "burnt";
import { useQueueActions } from "@/hooks/library/use-queue-actions";
import {
  addToQueue,
  playAlbumFromTrack,
  playNextInQueue,
  setShuffle,
} from "@/lib/player/player";
import type { Track } from "@/lib/types/library";

const mockAddToQueue = addToQueue as jest.MockedFunction<typeof addToQueue>;
const mockPlayNextInQueue = playNextInQueue as jest.MockedFunction<
  typeof playNextInQueue
>;
const mockPlayAlbumFromTrack = playAlbumFromTrack as jest.MockedFunction<
  typeof playAlbumFromTrack
>;
const mockSetShuffle = setShuffle as jest.MockedFunction<typeof setShuffle>;
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
  albumMbid: null,
  artistMbid: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("playNext", () => {
  it("confirms the insert", async () => {
    mockPlayNextInQueue.mockResolvedValue(2);
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.playNext(ALBUM_TRACKS, ALBUM);
    });

    expect(mockPlayNextInQueue).toHaveBeenCalledWith(ALBUM_TRACKS, ALBUM);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Playing next", preset: "done" }),
    );
  });

  it("explains a zero count rather than claiming success", async () => {
    mockPlayNextInQueue.mockResolvedValue(0);
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.playNext(ALBUM_TRACKS, ALBUM);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Nothing to add", preset: "error" }),
    );
  });

  it("shows the reason the edit threw", async () => {
    mockPlayNextInQueue.mockRejectedValue(new Error("Stream failed: 401"));
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.playNext(ALBUM_TRACKS, ALBUM);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Playback failed",
        message: "Stream failed: 401",
      }),
    );
  });
});

describe("addToQueue", () => {
  it("confirms the append", async () => {
    mockAddToQueue.mockResolvedValue(1);
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.addToQueue([TRACK], ALBUM);
    });

    expect(mockAddToQueue).toHaveBeenCalledWith([TRACK], ALBUM);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Added to queue", preset: "done" }),
    );
  });

  it("explains a zero count", async () => {
    mockAddToQueue.mockResolvedValue(0);
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.addToQueue([TRACK], ALBUM);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Nothing to add", preset: "error" }),
    );
  });
});

describe("playAlbum", () => {
  it("starts from the first track Aurral can stream", async () => {
    mockPlayAlbumFromTrack.mockResolvedValue(true);
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.playAlbum(
        [{ ...EARLIER_TRACK, streamPath: null }, TRACK],
        ALBUM,
      );
    });

    expect(mockPlayAlbumFromTrack).toHaveBeenCalledWith(
      [{ ...EARLIER_TRACK, streamPath: null }, TRACK],
      TRACK,
      ALBUM,
    );
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("says so when no track has a readable file", async () => {
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.playAlbum([{ ...TRACK, streamPath: null }], ALBUM);
    });

    expect(mockPlayAlbumFromTrack).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cannot play this album" }),
    );
  });

  it("says so when the player rejects the start without throwing", async () => {
    // A streamPath the URL builder cannot sign — an expired session — resolves
    // false rather than throwing, and would otherwise be a dead tap.
    mockPlayAlbumFromTrack.mockResolvedValue(false);
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.playAlbum(ALBUM_TRACKS, ALBUM);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cannot play this album" }),
    );
  });
});

describe("shuffleAlbum", () => {
  it("turns shuffle on before the play so the queue comes out shuffled", async () => {
    mockPlayAlbumFromTrack.mockResolvedValue(true);
    const order: string[] = [];
    mockSetShuffle.mockImplementation(async () => {
      order.push("shuffle");
    });
    mockPlayAlbumFromTrack.mockImplementation(async () => {
      order.push("play");
      return true;
    });
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.shuffleAlbum(ALBUM_TRACKS, ALBUM);
    });

    expect(mockSetShuffle).toHaveBeenCalledWith(true);
    expect(order).toEqual(["shuffle", "play"]);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("does not touch shuffle when no track has a readable file", async () => {
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.shuffleAlbum(
        [{ ...TRACK, streamPath: null }],
        ALBUM,
      );
    });

    expect(mockSetShuffle).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cannot play this album" }),
    );
  });

  it("says so when the player rejects the start without throwing", async () => {
    mockPlayAlbumFromTrack.mockResolvedValue(false);
    const { result } = await renderHook(() => useQueueActions());

    await act(async () => {
      await result.current.shuffleAlbum(ALBUM_TRACKS, ALBUM);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cannot play this album" }),
    );
  });
});
