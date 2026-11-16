import { fetch } from "expo/fetch";
import { setAuthToken, setBaseUrl, setCustomHeaders } from "@/lib/api/client";
import { fetchTranscodedAudio } from "@/lib/api/transcoding";
import { queryClient } from "@/lib/query-client";
import { authKeys } from "@/lib/query-keys";
import { SecureStorage } from "@/lib/storage";

const requests = jest.mocked(fetch);
const serverUrl = "https://fixture.example/music";
const session = "app-session";
const libraryPath = "/library/stream/12/77";
const AAC = { format: "aac", kbps: 128 } as const;
const body = { cancel: jest.fn().mockResolvedValue(undefined) };
const supported = { api: { version: 2, features: ["streamTranscoding"] } };

function bootstrap(data: object) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
  } as Awaited<ReturnType<typeof fetch>>;
}

function audio(mime: string) {
  return {
    ok: true,
    headers: { get: () => mime },
    body,
  } as unknown as Awaited<ReturnType<typeof fetch>>;
}

beforeEach(() => {
  requests.mockReset();
  body.cancel.mockClear();
  queryClient.clear();
  setBaseUrl(serverUrl);
  setAuthToken(session);
  setCustomHeaders({ "X-Proxy-Token": "proxy-proof" });
});

afterEach(() => jest.restoreAllMocks());

it.each([libraryPath, "/library/file-stream/12/77", "/playlists/stream/job-1"])(
  "transcodes %s with the existing session and no saved credentials",
  async (path) => {
    const credentials = jest.spyOn(SecureStorage, "getCredentials");
    const remember = jest.spyOn(SecureStorage, "getRememberCredentials");
    requests
      .mockResolvedValueOnce(bootstrap(supported))
      .mockResolvedValueOnce(audio("audio/aac; charset=binary"));

    const { signal } = new AbortController();
    await expect(fetchTranscodedAudio(path, AAC, signal)).resolves.toBe(body);

    const [health, stream] = requests.mock.calls;
    expect(health[0]).toBe(`${serverUrl}/api/health/bootstrap`);
    const url = new URL(String(stream[0]));
    expect(url.pathname).toBe(`/music/api${path}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      token: session,
      format: "aac",
      maxBitRate: "128",
    });
    expect(stream[1]).toMatchObject({
      headers: { "X-Proxy-Token": "proxy-proof" },
      redirect: "error",
      signal,
    });
    expect(credentials).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
  },
);

it("uses the existing bootstrap result and leaves older streams untouched", async () => {
  queryClient.setQueryData(authKeys.health(serverUrl), {
    api: { version: 2, features: [] },
  });
  const { signal } = new AbortController();
  await expect(
    fetchTranscodedAudio(libraryPath, AAC, signal),
  ).resolves.toBeNull();
  expect(requests).not.toHaveBeenCalled();
});

it("skips previews and routes outside the stream contract", async () => {
  const { signal } = new AbortController();
  await expect(
    fetchTranscodedAudio("/playlists/staging-stream/job", AAC, signal),
  ).resolves.toBeNull();
  await expect(
    fetchTranscodedAudio(
      "https://external.example/library/stream/12/77",
      AAC,
      signal,
    ),
  ).resolves.toBeNull();
  expect(requests).not.toHaveBeenCalled();
});

it("skips the stream if the session changes while loading bootstrap", async () => {
  const health = bootstrap(supported);
  jest.spyOn(health, "text").mockImplementation(async () => {
    setAuthToken(null);
    return JSON.stringify(supported);
  });
  requests.mockResolvedValueOnce(health);
  const { signal } = new AbortController();
  await expect(
    fetchTranscodedAudio(libraryPath, AAC, signal),
  ).resolves.toBeNull();
  expect(requests).toHaveBeenCalledTimes(1);
});

it("releases audio with an unexpected content type", async () => {
  queryClient.setQueryData(authKeys.health(serverUrl), supported);
  requests.mockResolvedValueOnce(audio("audio/flac"));
  const { signal } = new AbortController();
  await expect(
    fetchTranscodedAudio(libraryPath, AAC, signal),
  ).resolves.toBeNull();
  expect(body.cancel).toHaveBeenCalledTimes(1);
});
