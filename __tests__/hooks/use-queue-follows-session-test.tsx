jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { fetch } from "expo/fetch";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";
import { callbackManager } from "react-native-nitro-player/src/hooks/callbackManager";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useQueueFollowsSession } from "@/hooks/player/use-queue-follows-session";
import { api, setAuthToken } from "@/lib/api/client";
import { forgetQueue, onProgress, playQueueFrom } from "@/lib/player/player";
import type { PlayerTrack } from "@/lib/player/track-item";

const SERVER = "https://aurral.example.com";

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const queue = PlayerQueue as jest.Mocked<typeof PlayerQueue>;
const player = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const manager = callbackManager as jest.Mocked<typeof callbackManager>;

function jsonResponse(status: number, body: unknown): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: () => null },
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function queued(id: string): PlayerTrack {
  const streamPath = `/library/canonical-stream/1/${id}`;
  return {
    id,
    title: id,
    artist: "Radiohead",
    album: "Kid A",
    duration: 0,
    url: `${SERVER}/api${streamPath}?token=dead-token`,
    artwork: null,
    streamPath,
    coverPath: null,
    trackMbid: null,
    artistMbid: null,
    albumMbid: null,
    identityKey: null,
  };
}

const album = {
  albumTitle: "Kid A",
  artistName: "Radiohead",
  coverPath: null,
  artworkUrl: null,
  albumMbid: null,
  artistMbid: null,
};

/** A server just restored from a backup: no sessions, and accounts intact. */
function serveRestoredServer() {
  mockFetch.mockImplementation(async (url, init) => {
    if (String(url).endsWith("/auth/login")) {
      return jsonResponse(200, {
        token: "fresh-token",
        expiresAt: Date.now() + 86_400_000,
        user: { id: 1, username: "ada", role: "user", permissions: {} },
      });
    }
    const signedIn = (init?.headers as Record<string, string>).Authorization;
    return signedIn === "Bearer fresh-token"
      ? jsonResponse(200, { user: { id: 1 }, expiresAt: null })
      : jsonResponse(401, { error: "Unauthorized", code: "SESSION_INVALID" });
  });
}

async function renderListening() {
  const secure = new Map<string, string>(
    Object.entries({
      auth_token: "dead-token",
      user_json: JSON.stringify({
        id: 1,
        username: "ada",
        role: "user",
        permissions: {},
      }),
      remember_credentials: "true",
      saved_username: "ada",
      saved_password: "secret",
    }),
  );
  mockSecureStore.getItemAsync.mockImplementation(
    async (key) => secure.get(key) ?? null,
  );
  mockSecureStore.setItemAsync.mockImplementation(async (key, value) => {
    secure.set(key, value);
  });
  await AsyncStorage.setItem("server_url", SERVER);

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const { result } = await renderHook(
    () => {
      useQueueFollowsSession();
      return useAuth();
    },
    { wrapper },
  );
  await waitFor(() => expect(result.current.token).toBe("dead-token"));

  await playQueueFrom([queued("a"), queued("b")], "a", album);
  queue.addTracksToPlaylist.mockClear();
  return result;
}

function engineUrls() {
  const calls = queue.addTracksToPlaylist.mock.calls;
  return calls[calls.length - 1][1].map((track) => track.url);
}

const FRESH_URLS = [
  `${SERVER}/api/library/canonical-stream/1/a?token=fresh-token`,
  `${SERVER}/api/library/canonical-stream/1/b?token=fresh-token`,
];

// The facade wires itself into the engine once per module, so what it registered
// is captured before the first clearAllMocks wipes the record.
let engineStateChange: Parameters<typeof manager.subscribeToPlaybackState>[0];

beforeAll(() => {
  onProgress(() => {})();
  engineStateChange = manager.subscribeToPlaybackState.mock.calls[0][0];
});

beforeEach(async () => {
  await forgetQueue();
  jest.clearAllMocks();
  mockFetch.mockReset();
  await AsyncStorage.clear();
  setAuthToken(null);
});

describe("useQueueFollowsSession", () => {
  it("gives queued tracks the new token once re-auth recovers the session", async () => {
    serveRestoredServer();
    const session = await renderListening();

    await act(async () => {
      await api.get("/library/artists");
    });

    expect(session.current.token).toBe("fresh-token");
    await waitFor(() => expect(queue.addTracksToPlaylist).toHaveBeenCalled());
    expect(engineUrls()).toEqual(FRESH_URLS);
  });

  it("recovers from a failed stream when nothing else calls the server", async () => {
    serveRestoredServer();
    const session = await renderListening();

    await act(async () => {
      engineStateChange("stopped", "error");
    });

    await waitFor(() => expect(session.current.token).toBe("fresh-token"));
    await waitFor(() => expect(queue.addTracksToPlaylist).toHaveBeenCalled());
    expect(engineUrls()).toEqual(FRESH_URLS);
  });

  it("doesn't ask the server anything when the engine stops for another reason", async () => {
    serveRestoredServer();
    await renderListening();

    await act(async () => {
      engineStateChange("stopped", "end");
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("leaves the queue alone when a stream fails on a healthy session", async () => {
    mockFetch.mockImplementation(async () =>
      jsonResponse(200, { user: { id: 1 }, expiresAt: null }),
    );
    const session = await renderListening();

    await act(async () => {
      engineStateChange("stopped", "error");
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(session.current.token).toBe("dead-token");
    expect(queue.addTracksToPlaylist).not.toHaveBeenCalled();
    expect(player.play).toHaveBeenCalledTimes(1);
  });
});
