jest.mock("@/lib/api/client", () => ({
  api: { post: jest.fn() },
  ApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  setBaseUrl: jest.fn(),
  setAuthToken: jest.fn(),
}));

import { api } from "@/lib/api/client";
import { recordPlayEvent } from "@/lib/api/play-events";
import type { PlayEventInput } from "@/lib/types/play-events";

const mockPost = api.post as jest.Mock;

const event: PlayEventInput = {
  trackId: "77",
  title: "Everything In Its Right Place",
  artist: "Radiohead",
  album: "Kid A",
  artistMbid: "artist-mb-1",
  albumMbid: "album-mb-1",
  trackMbid: "track-mb-1",
  durationMs: 251_000,
  playedAt: 1_800_000_000_000,
  source: "pocket",
};

beforeEach(() => {
  mockPost.mockReset();
});

describe("recordPlayEvent", () => {
  it("posts the play and unwraps the stored event", async () => {
    mockPost.mockResolvedValue({
      data: { event: { ...event, id: 1, userId: 2 } },
    });

    const result = await recordPlayEvent(event);

    expect(mockPost).toHaveBeenCalledWith("/play-events", event);
    expect(result).toMatchObject({ id: 1, trackId: "77" });
  });

  it("returns null when the envelope carries no event", async () => {
    mockPost.mockResolvedValue({ data: {} });
    await expect(recordPlayEvent(event)).resolves.toBeNull();
  });
});
