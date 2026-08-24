jest.mock("@/lib/api/client", () => ({
  api: {
    defaults: { baseURL: "https://example.com/api" },
    post: jest.fn(),
  },
}));

import { api } from "@/lib/api/client";
import {
  addSharedPlaylistTracks,
  createSharedPlaylist,
  getFlowStreamSource,
  getFlowArtworkSource,
  queueTrackQualityUpgrade,
  researchMissingTracks,
  searchAllQualityUpgrades,
  searchPlaylistQualityUpgrades,
} from "@/lib/api/flow";
import type { SharedPlaylistTrack } from "@/lib/types/flow";

describe("getFlowStreamSource", () => {
  it("returns the stream URL with no headers when token is null", () => {
    const source = getFlowStreamSource("job-1", null);
    expect(source).toEqual({
      uri: "https://example.com/api/playlists/stream/job-1",
    });
  });

  it("attaches a Bearer Authorization header when a token is provided", () => {
    const source = getFlowStreamSource("job-1", "secret");
    expect(source).toEqual({
      uri: "https://example.com/api/playlists/stream/job-1",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("does not put the token in the URL", () => {
    const { uri } = getFlowStreamSource("job-1", "secret");
    expect(uri).not.toContain("token=");
    expect(uri).not.toContain("secret");
  });

  it("encodes the job id", () => {
    const { uri } = getFlowStreamSource("job/1?weird", "secret");
    expect(uri).toBe(
      "https://example.com/api/playlists/stream/job%2F1%3Fweird",
    );
  });
});

const TRACK: SharedPlaylistTrack = {
  artistName: "Radiohead",
  trackName: "Weird Fishes",
  albumName: "In Rainbows",
  artistMbid: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
};

const QUEUED_RESPONSE = {
  data: {
    success: true,
    playlistId: "pl-1",
    queued: true,
    operationId: "op-1",
  },
  status: 200,
};

describe("createSharedPlaylist", () => {
  it("posts the payload and returns the queued operation ids", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce(QUEUED_RESPONSE);
    const result = await createSharedPlaylist({
      name: "Keepers",
      tracks: [TRACK],
    });
    expect(api.post).toHaveBeenCalledWith("/playlists/shared-playlists", {
      name: "Keepers",
      tracks: [TRACK],
    });
    expect(result).toEqual({ playlistId: "pl-1", operationId: "op-1" });
  });
});

describe("addSharedPlaylistTracks", () => {
  it("posts the tracks to the playlist and returns the queued operation ids", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce(QUEUED_RESPONSE);
    const result = await addSharedPlaylistTracks("pl-1", [TRACK]);
    expect(api.post).toHaveBeenCalledWith(
      "/playlists/shared-playlists/pl-1/tracks",
      { tracks: [TRACK] },
    );
    expect(result).toEqual({ playlistId: "pl-1", operationId: "op-1" });
  });
});

describe("getFlowArtworkSource", () => {
  it("returns the artwork URL with no headers when token is null", () => {
    const source = getFlowArtworkSource("pl-1", null);
    expect(source).toEqual({
      uri: "https://example.com/api/playlists/artwork/pl-1",
    });
  });

  it("attaches a Bearer Authorization header when a token is provided", () => {
    const source = getFlowArtworkSource("pl-1", "secret");
    expect(source).toEqual({
      uri: "https://example.com/api/playlists/artwork/pl-1",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("does not put the token in the URL", () => {
    const { uri } = getFlowArtworkSource("pl-1", "secret");
    expect(uri).not.toContain("token=");
    expect(uri).not.toContain("secret");
  });
});

describe("searchAllQualityUpgrades", () => {
  it("posts to the global quality-upgrades route and returns the playlist count", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, queued: 0, scheduled: true, playlistCount: 3 },
      status: 200,
    });
    const result = await searchAllQualityUpgrades();
    expect(api.post).toHaveBeenCalledWith("/playlists/quality-upgrades");
    expect(result).toEqual({ playlistCount: 3 });
  });
});

describe("searchPlaylistQualityUpgrades", () => {
  it("posts to the playlist-scoped quality-upgrades route", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, queued: 0, scheduled: true },
      status: 200,
    });
    await searchPlaylistQualityUpgrades("pl-1");
    expect(api.post).toHaveBeenCalledWith("/playlists/quality-upgrades/pl-1");
  });

  it("encodes the playlist id", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, queued: 0, scheduled: true },
      status: 200,
    });
    await searchPlaylistQualityUpgrades("pl/1?weird");
    expect(api.post).toHaveBeenCalledWith(
      "/playlists/quality-upgrades/pl%2F1%3Fweird",
    );
  });
});

describe("queueTrackQualityUpgrade", () => {
  it("posts to the track-scoped route and returns 'queued'", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, queued: 1, jobId: "job-1" },
      status: 200,
    });
    const result = await queueTrackQualityUpgrade("pl-1", "job-1");
    expect(api.post).toHaveBeenCalledWith(
      "/playlists/quality-upgrades/pl-1/job-1",
    );
    expect(result).toBe("queued");
  });

  it("returns 'already-queued' when the server reports an active upgrade", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, queued: 0, alreadyQueued: true, jobId: "job-1" },
      status: 200,
    });
    const result = await queueTrackQualityUpgrade("pl-1", "job-1");
    expect(result).toBe("already-queued");
  });

  it("encodes both ids", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, queued: 1, jobId: "job/1" },
      status: 200,
    });
    await queueTrackQualityUpgrade("pl/1", "job/1");
    expect(api.post).toHaveBeenCalledWith(
      "/playlists/quality-upgrades/pl%2F1/job%2F1",
    );
  });
});

describe("researchMissingTracks", () => {
  it("posts to the research-missing route and returns the requeued count", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, requeued: 7 },
      status: 200,
    });
    const result = await researchMissingTracks();
    expect(api.post).toHaveBeenCalledWith("/playlists/research-missing");
    expect(result).toBe(7);
  });
});
