import { useSyncExternalStore } from "react";
import * as Network from "expo-network";

/**
 * Whether the phone has a connection, from the platform rather than from
 * failed requests. Offline means no network at all: one the platform can't
 * validate for the internet can still reach an Aurral server on the LAN or a
 * VPN, so it counts as online, and so does a state the phone can't tell.
 */

let offline = false;
let firstReading: Promise<void> | null = null;
const listeners = new Set<(offline: boolean) => void>();

function isOfflineState(state: Network.NetworkState): boolean {
  return state.isConnected === false;
}

function applyState(state: Network.NetworkState): void {
  const next = isOfflineState(state);
  if (next === offline) return;
  offline = next;
  listeners.forEach((listener) => listener(offline));
}

/** Starts watching once, for the life of the app. */
function watch(): Promise<void> {
  firstReading ??= (async () => {
    Network.addNetworkStateListener(applyState);
    try {
      applyState(await Network.getNetworkStateAsync());
    } catch {}
  })();
  return firstReading;
}

export function isOffline(): boolean {
  void watch();
  return offline;
}

/** Settles once the first reading is in, so a cold start offline knows it. */
export function networkKnown(): Promise<void> {
  return watch();
}

/** Hear about the connection coming and going. Returns unsubscribe. */
export function onNetworkChange(
  listener: (offline: boolean) => void,
): () => void {
  void watch();
  listeners.add(listener);
  return function unsubscribe(): void {
    listeners.delete(listener);
  };
}

function subscribe(onStoreChange: () => void): () => void {
  return onNetworkChange(onStoreChange);
}

const getOffline = () => offline;

export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, getOffline, getOffline);
}
