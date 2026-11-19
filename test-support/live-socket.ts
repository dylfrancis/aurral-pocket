// lib/api/live-socket without a socket, for
// `jest.mock("@/lib/api/live-socket", () => require("@/test-support/live-socket"))`.
// A test connects, drops and pushes as Aurral would through `mockLive`. The
// socket itself is tested in live-socket-test.
type ChannelListener = {
  channel: string;
  types: readonly string[];
  listener: (message: never) => void;
};

const channelListeners = new Set<ChannelListener>();
const statusListeners = new Set<() => void>();
let connected = false;

export function subscribeToLiveChannel(
  channel: string,
  types: readonly string[],
  listener: (message: never) => void,
): () => void {
  const entry = { channel, types, listener };
  channelListeners.add(entry);
  return () => channelListeners.delete(entry);
}

export function subscribeToLiveStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function isLiveSocketConnected(): boolean {
  return connected;
}

export const mockLive = {
  channels(): string[] {
    return [...new Set([...channelListeners].map((entry) => entry.channel))];
  },
  setConnected(next: boolean): void {
    connected = next;
    for (const listener of [...statusListeners]) listener();
  },
  push(message: { channel: string; type: string; [key: string]: unknown }) {
    for (const { channel, types, listener } of [...channelListeners]) {
      if (channel === message.channel && types.includes(message.type)) {
        (listener as (message: unknown) => void)({ timestamp: 1, ...message });
      }
    }
  },
  /** Between tests: forgets the connection. Unmounting drops the listeners. */
  reset(): void {
    connected = false;
  },
};
