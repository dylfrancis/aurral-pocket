jest.mock("@/lib/api/client", () => ({
  api: {
    defaults: { baseURL: "https://example.com/api" },
    post: jest.fn(),
  },
  buildAuthenticatedUrl: jest.fn(
    (path: string) => `https://example.com/api${path}?token=secret`,
  ),
}));

import { api, buildAuthenticatedUrl } from "@/lib/api/client";
import {
  addSharedPlaylistTracks,
  createSharedPlaylist,
  getFlowStreamUrl,
  getFlowArtworkSource,
} from "@/lib/api/flow";
import type { SharedPlaylistTrack } from "@/lib/types/flow";

describe("getFlowStreamUrl", () => {
  it("returns a URL that authenticates itself", () => {
    expect(getFlowStreamUrl("job-1")).toBe(
      "https://example.com/api/playlists/stream/job-1?token=secret",
    );
  });

  it("encodes the job id", () => {
    getFlowStreamUrl("job/1?weird");

    expect(buildAuthenticatedUrl).toHaveBeenCalledWith(
      "/playlists/stream/job%2F1%3Fweird",
    );
  });

  it("returns null while signed out", () => {
    (buildAuthenticatedUrl as jest.Mock).mockReturnValueOnce(null);

    expect(getFlowStreamUrl("job-1")).toBeNull();
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
