jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/api/auth", () => ({
  getMe: jest.fn(),
}));

import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { useAuth } from "@/contexts/auth-context";
import { useLiveChannel } from "@/hooks/live/use-live-channel";
import { useLiveSocketFollowsSession } from "@/hooks/live/use-live-socket-follows-session";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

const mockUseAuth = useAuth as jest.Mock;
const mockGetMe = getMe as jest.Mock;

const SESSION = {
  serverUrl: "https://aurral.example.com",
  token: "session-token",
  customHeaders: {
    "CF-Access-Client-Id": "client-id",
    "CF-Access-Client-Secret": "client-secret",
  },
};

/** Stands in for React Native's WebSocket, with the server's side as methods. */
class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  sent: { type: string; channels?: string[] }[] = [];
  closeCalls = 0;

  constructor(
    public url: string,
    public protocols: unknown,
    public options: { headers: Record<string, string> },
  ) {
    FakeSocket.all.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.closeCalls += 1;
  }

  async open() {
    await act(async () => this.onopen?.());
  }

  /** Opens and accepts the token, as Aurral does. */
  async accept() {
    await this.open();
    await this.receive({
      type: "connected",
      clientId: "ws_1",
      subscriptions: ["status"],
      version: "3.0.0",
    });
  }

  async receive(message: object) {
    await act(async () => this.onmessage?.({ data: JSON.stringify(message) }));
  }

  async drop(code = 1006) {
    await act(async () => this.onclose?.({ code }));
  }

  subscriptions() {
    return this.sent.filter((message) => message.type !== "ping");
  }
}

function latest() {
  return FakeSocket.all[FakeSocket.all.length - 1];
}

async function wait(ms: number) {
  await act(async () => jest.advanceTimersByTime(ms));
}

async function moveApp(state: AppStateStatus) {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls;
  for (const [event, listener] of calls) {
    if (event === "change") await act(async () => listener(state));
  }
}

const finished = {
  channel: "plugins",
  timestamp: 1,
  type: "plugin_action_finished",
  ok: true,
  message: "Imported 12 tracks",
};

async function renderLive() {
  const onPlugins = jest.fn();
  const onQueue = jest.fn();
  const view = await renderHook(() => {
    useLiveSocketFollowsSession();
    useLiveChannel("play-queue", ["play_queue_changed"], onQueue);
    return useLiveChannel("plugins", ["plugin_action_finished"], onPlugins);
  });
  return { ...view, onPlugins, onQueue };
}

const originalWebSocket = global.WebSocket;

beforeAll(() => {
  global.WebSocket = FakeSocket as unknown as typeof WebSocket;
});

afterAll(() => {
  global.WebSocket = originalWebSocket;
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  FakeSocket.all = [];
  mockUseAuth.mockReturnValue(SESSION);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("live socket", () => {
  it("connects as the session with its headers and passes on its channels' messages", async () => {
    const { result, onPlugins, onQueue } = await renderLive();
    const socket = latest();

    expect(socket.url).toBe("wss://aurral.example.com/ws?token=session-token");
    expect(socket.options.headers).toEqual(SESSION.customHeaders);
    expect(result.current.isConnected).toBe(false);

    await socket.accept();
    expect(result.current.isConnected).toBe(true);
    expect(socket.subscriptions()).toEqual([
      { type: "subscribe", channels: ["play-queue", "plugins"] },
    ]);

    await socket.receive(finished);
    await socket.receive({ ...finished, type: "plugin_action_started" });
    await socket.receive({ ...finished, channel: "library" });

    expect(onPlugins).toHaveBeenCalledTimes(1);
    expect(onPlugins).toHaveBeenCalledWith(finished);
    expect(onQueue).not.toHaveBeenCalled();
  });

  it("reconnects a dropped connection with backoff and subscribes again", async () => {
    const { result } = await renderLive();
    await latest().accept();

    await latest().drop();
    expect(result.current.isConnected).toBe(false);
    await wait(999);
    expect(FakeSocket.all).toHaveLength(1);
    await wait(1);
    expect(FakeSocket.all).toHaveLength(2);

    // A failed attempt waits twice as long before the next.
    await latest().drop();
    await wait(1999);
    expect(FakeSocket.all).toHaveLength(2);
    await wait(1);
    expect(FakeSocket.all).toHaveLength(3);

    await latest().accept();
    expect(result.current.isConnected).toBe(true);
    expect(latest().subscriptions()).toEqual([
      { type: "subscribe", channels: ["play-queue", "plugins"] },
    ]);

    // Connecting starts the backoff over.
    await latest().drop();
    await wait(1000);
    expect(FakeSocket.all).toHaveLength(4);
  });

  it("replaces a connection that goes silent, connecting or between pings", async () => {
    await renderLive();
    await wait(9_999);
    expect(latest().closeCalls).toBe(0);
    await wait(1);
    expect(latest().closeCalls).toBe(1);
    await wait(1000);
    expect(FakeSocket.all).toHaveLength(2);

    const socket = latest();
    await socket.accept();

    await wait(30_000);
    expect(socket.sent).toContainEqual({ type: "ping" });
    await socket.receive({ type: "pong", timestamp: 2 });
    await wait(10_000);
    expect(socket.closeCalls).toBe(0);

    await wait(20_000);
    await wait(10_000);
    expect(socket.closeCalls).toBe(1);
    await wait(1000);
    expect(FakeSocket.all).toHaveLength(3);
  });

  it("closes in the background and reconnects in the foreground", async () => {
    const { result } = await renderLive();
    const socket = latest();
    await socket.accept();

    await moveApp("inactive");
    expect(socket.closeCalls).toBe(0);

    await moveApp("background");
    expect(socket.closeCalls).toBe(1);
    expect(result.current.isConnected).toBe(false);
    await wait(60_000);
    expect(FakeSocket.all).toHaveLength(1);

    await moveApp("active");
    expect(FakeSocket.all).toHaveLength(2);
    await latest().accept();
    expect(latest().subscriptions()).toEqual([
      { type: "subscribe", channels: ["play-queue", "plugins"] },
    ]);
  });

  it("closes a socket the app gave up on while it was still connecting", async () => {
    await renderLive();
    const socket = latest();

    await moveApp("background");
    // Android drops a close sent before the socket opens.
    await socket.open();

    expect(socket.closeCalls).toBe(2);
  });

  it("closes on sign-out and stays closed", async () => {
    const { rerender } = await renderLive();
    const socket = latest();
    await socket.accept();

    mockUseAuth.mockReturnValue({ ...SESSION, token: null });
    await rerender({});

    expect(socket.closeCalls).toBe(1);
    await wait(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it.each([
    ["accepts the session", 2, () => ({ user: { id: 1 } })],
    [
      "can't be reached",
      2,
      () => {
        throw new ApiError(0, "Unable to reach server. Check your connection.");
      },
    ],
    // Re-auth brings a new token, and the new token reopens the socket.
    [
      "says the session is gone",
      1,
      () => {
        throw new ApiError(401, "Session expired");
      },
    ],
  ])(
    "holds a refused token until the server %s",
    async (_, sockets, answer) => {
      let settle: () => void = () => {};
      mockGetMe.mockReturnValue(
        new Promise((resolve, reject) => {
          settle = () => {
            try {
              resolve(answer());
            } catch (error) {
              reject(error);
            }
          };
        }),
      );
      await renderLive();
      await latest().open();

      await latest().drop(4401);

      expect(mockGetMe).toHaveBeenCalledTimes(1);
      await wait(60_000);
      expect(FakeSocket.all).toHaveLength(1);

      await act(async () => settle());
      await wait(1000);
      expect(FakeSocket.all).toHaveLength(sockets);
    },
  );

  it("unsubscribes from a channel once nothing on screen hears it", async () => {
    await renderLive();
    const socket = latest();
    await socket.accept();

    const first = await renderHook(() =>
      useLiveChannel("library", ["library_scan_completed"], () => {}),
    );
    const second = await renderHook(() =>
      useLiveChannel("library", ["release_metadata_refreshed"], () => {}),
    );
    await first.unmount();
    await second.unmount();

    expect(socket.subscriptions().slice(1)).toEqual([
      { type: "subscribe", channels: ["library"] },
      { type: "unsubscribe", channels: ["library"] },
    ]);
  });
});
