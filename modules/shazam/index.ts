import {
  requireOptionalNativeModule,
  type EventSubscription,
} from "expo-modules-core";

import type {
  ShazamError,
  ShazamMatch,
  ShazamModuleEvents,
} from "./src/Shazam.types";

export type {
  ShazamError,
  ShazamErrorCode,
  ShazamMatch,
} from "./src/Shazam.types";

type ShazamNativeModule = {
  /**
   * Begin listening on the microphone and matching against the Shazam catalog.
   * Resolves once capture has started; results arrive via `onMatch` /
   * `onNoMatch` / `onError` events. On Android a `developerToken` is required;
   * on iOS it is ignored (catalog access rides the app entitlement).
   */
  startListening(developerToken: string | null): Promise<void>;
  /** Stop the microphone and tear down the session. Safe to call when idle. */
  stopListening(): Promise<void>;
  addListener<E extends keyof ShazamModuleEvents>(
    event: E,
    listener: ShazamModuleEvents[E],
  ): EventSubscription;
};

const ShazamModule = requireOptionalNativeModule<ShazamNativeModule>("Shazam");

/** True when the native module is linked (false on web / Expo Go). */
export const isShazamAvailable = ShazamModule != null;

export function startListening(developerToken: string | null): Promise<void> {
  if (!ShazamModule) {
    return Promise.reject(
      new Error("ShazamKit is not available on this platform"),
    );
  }
  return ShazamModule.startListening(developerToken);
}

export function stopListening(): Promise<void> {
  return ShazamModule?.stopListening() ?? Promise.resolve();
}

export function addMatchListener(
  listener: (match: ShazamMatch) => void,
): EventSubscription | null {
  return (
    ShazamModule?.addListener("onMatch", ({ match }) => listener(match)) ?? null
  );
}

export function addNoMatchListener(
  listener: () => void,
): EventSubscription | null {
  return ShazamModule?.addListener("onNoMatch", listener) ?? null;
}

export function addErrorListener(
  listener: (error: ShazamError) => void,
): EventSubscription | null {
  return ShazamModule?.addListener("onError", listener) ?? null;
}
