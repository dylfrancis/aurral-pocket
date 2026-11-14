import { useSyncExternalStore } from "react";
import * as Network from "expo-network";

/**
 * Whether the phone has a connection, from the platform rather than from
 * failed requests. Offline means no network at all: one the platform can't
 * validate for the internet can still reach an Aurral server on the LAN or a
 * VPN, so it counts as online, and so does a state the phone can't tell.
 */

let offline = false;
let metered = false;
let firstReading: Promise<void> | null = null;
const listeners = new Set<(offline: boolean) => void>();
const meteredListeners = new Set<(metered: boolean) => void>();

function isOfflineState(state: Network.NetworkState): boolean {
  return state.isConnected === false;
}

/**
 * Pocket's patch of expo-network adds `isMetered`, the platform's own flag for
 * cellular data and hotspots. A VPN hides the type on iOS, so the type is only
 * the fallback for a build without the patch.
 */
function isMeteredState(state: Network.NetworkState): boolean {
  if (isOfflineState(state)) return false;
  const flag = (state as { isMetered?: unknown }).isMetered;
  if (typeof flag === "boolean") return flag;
  return state.type === Network.NetworkStateType.CELLULAR;
}

function applyState(state: Network.NetworkState): void {
  const nextOffline = isOfflineState(state);
  const nextMetered = isMeteredState(state);
  const offlineChanged = nextOffline !== offline;
  const meteredChanged = nextMetered !== metered;
  // Both are read before anyone hears, so a listener never sees half a change.
  offline = nextOffline;
  metered = nextMetered;
  if (offlineChanged) listeners.forEach((listener) => listener(offline));
  if (meteredChanged) meteredListeners.forEach((listener) => listener(metered));
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

/** On cellular data or a hotspot, which Wi-Fi Only waits out. */
export function isMetered(): boolean {
  void watch();
  return metered;
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

/** Hear about moving between Wi-Fi and cellular. Returns unsubscribe. */
export function onMeteredChange(
  listener: (metered: boolean) => void,
): () => void {
  void watch();
  meteredListeners.add(listener);
  return function unsubscribe(): void {
    meteredListeners.delete(listener);
  };
}

function subscribe(onStoreChange: () => void): () => void {
  return onNetworkChange(onStoreChange);
}

const getOffline = () => offline;

export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, getOffline, getOffline);
}
