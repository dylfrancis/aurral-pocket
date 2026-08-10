jest.mock("@/lib/api/client", () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
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
import {
  addDiscoveryFeedback,
  deleteDiscoveryFeedback,
  getDiscoveryFeedback,
} from "@/lib/api/discovery-feedback";

const mockGet = api.get as jest.Mock;
const mockPost = api.post as jest.Mock;
const mockDelete = api.delete as jest.Mock;

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
});

describe("getDiscoveryFeedback", () => {
  // Aurral wraps the list as { feedback: [...] }; reading r.data directly
  // yields an empty blocklist with no error to show for it.
  it("unwraps the feedback array from the response envelope", async () => {
    const entry = {
      id: "fb-1",
      artistId: "mbid-1",
      artistName: "Boards of Canada",
      action: "block_artist",
      sourceContext: "blocklist",
    };
    mockGet.mockResolvedValue({ data: { feedback: [entry] } });

    const result = await getDiscoveryFeedback();

    expect(mockGet).toHaveBeenCalledWith("/discover/feedback");
    expect(result).toEqual([entry]);
  });

  it("returns an empty array when the envelope has no feedback", async () => {
    mockGet.mockResolvedValue({ data: {} });
    await expect(getDiscoveryFeedback()).resolves.toEqual([]);
  });

  it("returns an empty array for a bare array body", async () => {
    // Defensive: an unwrapped body is not the documented shape, so it should
    // degrade to empty rather than be trusted.
    mockGet.mockResolvedValue({ data: [] });
    await expect(getDiscoveryFeedback()).resolves.toEqual([]);
  });
});

describe("addDiscoveryFeedback", () => {
  it("posts the block payload", async () => {
    mockPost.mockResolvedValue({ data: { success: true } });

    await addDiscoveryFeedback({
      action: "block_artist",
      artistId: "mbid-1",
      artistName: "Boards of Canada",
      sourceContext: "blocklist",
    });

    expect(mockPost).toHaveBeenCalledWith("/discover/feedback", {
      action: "block_artist",
      artistId: "mbid-1",
      artistName: "Boards of Canada",
      sourceContext: "blocklist",
    });
  });
});

describe("deleteDiscoveryFeedback", () => {
  it("encodes the id in the path", async () => {
    mockDelete.mockResolvedValue({ data: { success: true } });

    await deleteDiscoveryFeedback("fb/1");

    expect(mockDelete).toHaveBeenCalledWith("/discover/feedback/fb%2F1");
  });
});
