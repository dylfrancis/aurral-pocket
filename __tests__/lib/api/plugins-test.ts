import { fetch } from "expo/fetch";
import { setAuthToken, setBaseUrl } from "@/lib/api/client";
import { runPluginAction } from "@/lib/api/plugins";
import type { PluginAction } from "@/lib/types/plugins";

const requests = jest.mocked(fetch);

const SYNC_TO_BOX: PluginAction = {
  pluginId: "send-to-box",
  pluginName: "Send to Box",
  id: "send",
  label: "Send to Box",
  target: "playlist",
};

/** Answers after `ms`, unless the caller gives up first, as fetch does. */
function answerAfter(ms: number, message: string) {
  return (_url: unknown, init?: { signal?: AbortSignal | null }) =>
    new Promise<Awaited<ReturnType<typeof fetch>>>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ message }),
          } as Awaited<ReturnType<typeof fetch>>),
        ms,
      );
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      });
    });
}

beforeEach(() => {
  jest.useFakeTimers();
  requests.mockReset();
  setBaseUrl("https://fixture.example");
  setAuthToken("app-session");
});

afterEach(() => {
  jest.useRealTimers();
  setAuthToken(null);
});

describe("runPluginAction", () => {
  it("waits out a sync action that takes longer than other requests may", async () => {
    requests.mockImplementation(answerAfter(110_000, "Sent 12 tracks"));

    const run = runPluginAction(SYNC_TO_BOX, { playlistId: "flow-1" });
    await jest.advanceTimersByTimeAsync(110_000);

    await expect(run).resolves.toBe("Sent 12 tracks");
    expect(requests).toHaveBeenCalledWith(
      "https://fixture.example/api/plugins/send-to-box/actions/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ playlistId: "flow-1" }),
      }),
    );
  });
});
