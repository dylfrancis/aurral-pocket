jest.mock("@/lib/api/client", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { api } from "@/lib/api/client";
import { getBlocklist, updateBlocklist } from "@/lib/api/discover";

const mockApi = api as unknown as {
  get: jest.Mock;
  put: jest.Mock;
};

const MBID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getBlocklist", () => {
  it("calls GET /discover/blocklist and normalizes the response", async () => {
    mockApi.get.mockResolvedValue({
      data: {
        artists: [{ mbid: MBID.toUpperCase(), name: "Foo" }],
        tags: ["POP", "pop"],
      },
    });

    const result = await getBlocklist();
    expect(mockApi.get).toHaveBeenCalledWith("/discover/blocklist");
    expect(result).toEqual({
      artists: [{ mbid: MBID, name: "Foo" }],
      tags: ["pop"],
    });
  });

  it("returns empty lists when server returns missing fields", async () => {
    mockApi.get.mockResolvedValue({ data: {} });

    const result = await getBlocklist();
    expect(result).toEqual({ artists: [], tags: [] });
  });

  it("propagates errors", async () => {
    mockApi.get.mockRejectedValue(new Error("500"));
    await expect(getBlocklist()).rejects.toThrow("500");
  });
});

describe("updateBlocklist", () => {
  it("sends PUT with full blocklist body and returns the normalized server response", async () => {
    mockApi.put.mockResolvedValue({
      data: {
        success: true,
        blocklist: {
          artists: [{ mbid: MBID, name: "Foo" }],
          tags: ["pop"],
        },
      },
    });

    const result = await updateBlocklist({
      artists: [{ mbid: MBID, name: "Foo" }],
      tags: ["pop"],
    });

    expect(mockApi.put).toHaveBeenCalledWith("/discover/blocklist", {
      artists: [{ mbid: MBID, name: "Foo" }],
      tags: ["pop"],
    });
    expect(result).toEqual({
      artists: [{ mbid: MBID, name: "Foo" }],
      tags: ["pop"],
    });
  });

  it("falls back to the sent blocklist when the server omits one", async () => {
    mockApi.put.mockResolvedValue({ data: { success: true } });

    const result = await updateBlocklist({
      artists: [{ mbid: MBID, name: "Foo" }],
      tags: [],
    });

    expect(result).toEqual({
      artists: [{ mbid: MBID, name: "Foo" }],
      tags: [],
    });
  });

  it("propagates errors", async () => {
    mockApi.put.mockRejectedValue(new Error("403"));
    await expect(updateBlocklist({ artists: [], tags: [] })).rejects.toThrow(
      "403",
    );
  });
});
