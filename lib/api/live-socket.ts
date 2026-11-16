import type {
  LiveChannel,
  LiveMessage,
  LiveMessageType,
} from "@/lib/types/live";

/** What the socket needs from the signed-in session. */
export type LiveSession = {
  serverUrl: string;
  token: string;
  /** Cloudflare Access refuses an upgrade without them, like any request. */
  customHeaders: Record<string, string>;
};

// The web client's timings.
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 15_000;
const PING_INTERVAL_MS = 30_000;
const ANSWER_TIMEOUT_MS = 10_000;

// Aurral accepts the upgrade, then closes with 4401 for a token it doesn't
// know and 4403 for a suspended account. Retrying won't change either.
const REFUSED_CODES = new Set([4401, 4403]);

// React Native's WebSocket takes request headers, which the DOM typings lack.
type NativeWebSocket = new (
  url: string,
  protocols: undefined,
  options: { headers: Record<string, string> },
) => WebSocket;

type ChannelListener = {
  types: ReadonlySet<string>;
  listener: (message: never) => void;
};

let session: LiveSession | null = null;
let socket: WebSocket | null = null;
let connected = false;
let attempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let answerTimer: ReturnType<typeof setTimeout> | null = null;

const channelListeners = new Map<string, Set<ChannelListener>>();
const statusListeners = new Set<() => void>();
const refusedListeners = new Set<() => void>();

/**
 * Connects to Aurral's socket as this session and keeps it connected, until the
 * returned function closes it. Opening another session closes this one.
 */
export function openLiveSocket(next: LiveSession): () => void {
  closeSession();
  session = next;
  attempts = 0;
  connect();
  return function close(): void {
    if (session === next) closeSession();
  };
}

/**
 * Hear about the server refusing the session, after which the socket stops
 * retrying. Returns unsubscribe.
 */
export function onLiveSocketRefused(listener: () => void): () => void {
  refusedListeners.add(listener);
  return function unsubscribe(): void {
    refusedListeners.delete(listener);
  };
}

/** Retry a refused socket once the session turns out to be fine. */
export function resumeLiveSocket(): void {
  if (session && !socket && !retryTimer) scheduleRetry();
}

/**
 * Hear a channel's messages of the given types. Returns unsubscribe. Messages
 * sent while the socket is down are lost, so refetch once it reconnects.
 */
export function subscribeToLiveChannel<
  C extends LiveChannel,
  T extends LiveMessageType<C>,
>(
  channel: C,
  types: readonly T[],
  listener: (message: LiveMessage<C, T>) => void,
): () => void {
  const entry: ChannelListener = { types: new Set(types), listener };
  let entries = channelListeners.get(channel);
  if (!entries) {
    entries = new Set();
    channelListeners.set(channel, entries);
    send({ type: "subscribe", channels: [channel] });
  }
  entries.add(entry);

  return function unsubscribe(): void {
    const current = channelListeners.get(channel);
    if (!current?.delete(entry) || current.size > 0) return;
    channelListeners.delete(channel);
    send({ type: "unsubscribe", channels: [channel] });
  };
}

/** True while the socket is signed in and subscribed. */
export function isLiveSocketConnected(): boolean {
  return connected;
}

/** Hear the socket connect and drop. Returns unsubscribe. */
export function subscribeToLiveStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return function unsubscribe(): void {
    statusListeners.delete(listener);
  };
}

function socketUrl({ serverUrl, token }: LiveSession): string {
  const wsServerUrl = serverUrl.replace(/^http/i, "ws");
  return `${wsServerUrl}/ws?token=${encodeURIComponent(token)}`;
}

function connect(): void {
  clearRetry();
  if (!session) return;

  const current = new (WebSocket as NativeWebSocket)(
    socketUrl(session),
    undefined,
    {
      headers: session.customHeaders,
    },
  );
  socket = current;
  // Android sets no read timeout, so an upgrade a proxy holds open would
  // otherwise wait forever.
  expectAnswer();

  current.onopen = () => {
    // Android ignores a close sent while connecting, so close it again now.
    if (socket !== current) current.close();
  };
  current.onmessage = (event) => {
    if (socket === current) receive(event.data);
  };
  current.onclose = (event) => {
    if (socket === current) drop(event.code);
  };
}

function receive(data: unknown): void {
  // Anything from the server shows the connection is alive.
  clearAnswerTimer();

  let message: unknown;
  try {
    message = JSON.parse(String(data));
  } catch {
    return;
  }
  if (typeof message !== "object" || message === null) return;
  const { type, channel } = message as { type?: unknown; channel?: unknown };

  // Aurral says `connected` only once it has accepted the token.
  if (type === "connected") {
    attempts = 0;
    connected = true;
    send({ type: "subscribe", channels: [...channelListeners.keys()] });
    startHeartbeat();
    notifyStatus();
    return;
  }
  if (typeof channel !== "string" || typeof type !== "string") return;

  const entries = channelListeners.get(channel);
  if (!entries) return;
  // A listener can unsubscribe as it hears the message.
  for (const { types, listener } of [...entries]) {
    if (types.has(type)) (listener as (message: unknown) => void)(message);
  }
}

function drop(code?: number): void {
  retire();
  if (!session) return;
  if (code !== undefined && REFUSED_CODES.has(code)) {
    for (const listener of [...refusedListeners]) listener();
    return;
  }
  scheduleRetry();
}

function scheduleRetry(): void {
  clearRetry();
  const delay = Math.min(RETRY_BASE_MS * 2 ** attempts, RETRY_MAX_MS);
  attempts += 1;
  retryTimer = setTimeout(connect, delay);
}

function closeSession(): void {
  session = null;
  clearRetry();
  retire();
}

function retire(): void {
  const current = socket;
  socket = null;
  stopHeartbeat();
  if (connected) {
    connected = false;
    notifyStatus();
  }
  current?.close();
}

function send(message: { type: string; channels?: string[] }): void {
  if (!connected || !socket) return;
  if (message.channels?.length === 0) return;
  socket.send(JSON.stringify(message));
}

function startHeartbeat(): void {
  stopHeartbeat();
  pingTimer = setInterval(() => {
    send({ type: "ping" });
    // A connection that dies without a close, as on a network change, only
    // shows up as silence.
    expectAnswer();
  }, PING_INTERVAL_MS);
}

/** Give up on the socket unless the server says something soon. */
function expectAnswer(): void {
  answerTimer ??= setTimeout(() => drop(), ANSWER_TIMEOUT_MS);
}

function stopHeartbeat(): void {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
  clearAnswerTimer();
}

function clearAnswerTimer(): void {
  if (answerTimer) clearTimeout(answerTimer);
  answerTimer = null;
}

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function notifyStatus(): void {
  for (const listener of [...statusListeners]) listener();
}
