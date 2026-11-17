import { fetch } from "expo/fetch";
import { setAuthToken, setBaseUrl, setCustomHeaders } from "@/lib/api/client";
import {
  askLoudness,
  forgetLoudness,
  knownLoudness,
  levelingGain,
  onLoudnessMeasured,
} from "@/lib/player/loudness";

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

function headResponse(lufs: string | null, status = 200): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-aurral-loudness" ? lufs : null,
    },
  };
}

async function settle() {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

beforeEach(() => {
  forgetLoudness();
  mockFetch.mockReset();
  setBaseUrl("https://music.example");
  setAuthToken("token-1");
  setCustomHeaders({ "CF-Access-Client-Id": "proxy-id" });
});

describe("levelingGain", () => {
  it.each([
    { lufs: -8, gain: 0.501 },
    { lufs: -14, gain: 1 },
    { lufs: -21.8, gain: 1 },
  ])("is $gain for a track at $lufs LUFS", ({ lufs, gain }) => {
    expect(levelingGain(lufs)).toBeCloseTo(gain, 3);
  });
});

describe("askLoudness", () => {
  it("asks once with a HEAD of the stream, with the session's token and the proxy headers", async () => {
    mockFetch.mockResolvedValue(headResponse("-9.5"));
    const heard: [string, number][] = [];
    const unsubscribe = onLoudnessMeasured((path, lufs) =>
      heard.push([path, lufs]),
    );

    askLoudness(["/library/stream/12/71"]);
    await settle();
    askLoudness(["/library/stream/12/71"]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://music.example/api/library/stream/12/71?token=token-1",
      expect.objectContaining({
        method: "HEAD",
        headers: { "CF-Access-Client-Id": "proxy-id" },
        redirect: "error",
      }),
    );
    expect(knownLoudness("/library/stream/12/71")).toBe(-9.5);
    expect(heard).toEqual([["/library/stream/12/71", -9.5]]);
    unsubscribe();
  });

  it("takes no header or a missing file as no measurement, and asks again after a failed request", async () => {
    mockFetch
      .mockResolvedValueOnce(headResponse(null))
      .mockResolvedValueOnce(headResponse(null, 404))
      .mockResolvedValueOnce(headResponse(null, 503))
      .mockRejectedValueOnce(new Error("offline"));

    askLoudness(["/a", "/b", "/c", "/d"]);
    await settle();

    expect(knownLoudness("/a")).toBeNull();
    expect(knownLoudness("/b")).toBeNull();
    expect(knownLoudness("/c")).toBeUndefined();
    expect(knownLoudness("/d")).toBeUndefined();

    mockFetch.mockResolvedValue(headResponse("-12"));
    askLoudness(["/a", "/b", "/c", "/d"]);
    await settle();

    expect(mockFetch).toHaveBeenCalledTimes(6);
    expect(knownLoudness("/d")).toBe(-12);
  });

  it("stops asking about a stream it's no longer given, and drops its answer", async () => {
    let answer!: (response: any) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    mockFetch.mockResolvedValue(headResponse("-10"));

    askLoudness(["/a"]);
    askLoudness(["/b"]);
    answer(headResponse("-6"));
    await settle();

    expect(mockFetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(knownLoudness("/a")).toBeUndefined();
    expect(knownLoudness("/b")).toBe(-10);
  });
});
