import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { setBaseUrl, setServerAlias } from "@/lib/api/client";
import type { TailscaleSettings } from "@/lib/types/tailscale";
import {
  addTailscaleStatusListener,
  forgetTailscale,
  getTailscaleStatus,
  isTailscaleAvailable,
  startTailscale,
  stopTailscale,
  type TailscaleStatus,
} from "@/modules/tailscale";

export { isTailscaleAvailable };

// Fixed, so URLs the player saved stay valid from one launch to the next.
export const GATEWAY_PORT = 47862;
const HOSTNAME = "aurral-pocket";

// An auth key signs the node in on its own; Tailscale's sign-in page only
// opens when it hasn't within this long.
const AUTH_KEY_GRACE_MS = 10_000;
// After the sign-in page closes, the node may take a moment to come up.
const SIGN_IN_SETTLE_MS = 10_000;
const CONNECT_TIMEOUT_MS = 5 * 60_000;

let status: TailscaleStatus = { state: "Off" };
const statusListeners = new Set<() => void>();
let subscribed = false;

let runningGateway: { serverUrl: string; port: number } | null = null;
// Forgetting a node no saved server names still logs out of its last control
// server.
let lastControlURL: string | undefined;
/** `runningGateway` as a stable snapshot for useSyncExternalStore. */
let gatewaySnapshot: { serverUrl: string; url: string } | null = null;

function setRunningGateway(next: { serverUrl: string; port: number } | null) {
  runningGateway = next;
  gatewaySnapshot = next
    ? { serverUrl: next.serverUrl, url: loopbackUrl(next.port) }
    : null;
}

// Starting, stopping and forgetting share the node's keys, so they run one at
// a time: a connect right after Change Server waits for the forget.
let pending: Promise<unknown> = Promise.resolve();

function serially<T>(task: () => Promise<T>): Promise<T> {
  const result = pending.then(task, task);
  pending = result.catch(() => {});
  return result;
}

function loopbackUrl(port: number) {
  return `http://127.0.0.1:${port}`;
}

function setStatus(next: TailscaleStatus) {
  status = next;
  statusListeners.forEach((listener) => listener());
}

function onStatus(next: TailscaleStatus) {
  // The port was taken when the listener reopened, so requests from now on
  // go to the new one. URLs already handed out still point at the old one.
  if (runningGateway && next.port && next.port !== runningGateway.port) {
    setRunningGateway({ ...runningGateway, port: next.port });
    setBaseUrl(loopbackUrl(next.port));
    setServerAlias(runningGateway.serverUrl, loopbackUrl(next.port));
  }
  setStatus(next);
}

function listen() {
  if (subscribed) return;
  subscribed = addTailscaleStatusListener(onStatus) !== null;
}

export function getTailscaleStatusSnapshot(): TailscaleStatus {
  return status;
}

export function subscribeToTailscaleStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function useTailscaleStatus(): TailscaleStatus {
  return useSyncExternalStore(
    subscribeToTailscaleStatus,
    getTailscaleStatusSnapshot,
  );
}

export function gatewayUrlFor(serverUrl: string | null): string | null {
  if (!runningGateway || !serverUrl || runningGateway.serverUrl !== serverUrl)
    return null;
  return loopbackUrl(runningGateway.port);
}

function getGatewaySnapshot() {
  return gatewaySnapshot;
}

/** gatewayUrlFor, kept current as the gateway starts, stops or moves port. */
export function useGatewayUrl(serverUrl: string | null): string | null {
  const gateway = useSyncExternalStore(
    subscribeToTailscaleStatus,
    getGatewaySnapshot,
  );
  return gateway && gateway.serverUrl === serverUrl ? gateway.url : null;
}

export function isGatewayRunning(): boolean {
  return runningGateway !== null;
}

/**
 * Resolves with the API client's base URL once the loopback port is open, before
 * the node is on the tailnet. An auth key is only read the first time.
 */
export function startGateway(
  serverUrl: string,
  settings: TailscaleSettings,
  authKey?: string,
): Promise<string> {
  return serially(async () => {
    listen();
    if (runningGateway && runningGateway.serverUrl !== serverUrl)
      await stopRunning();
    return start(serverUrl, settings, authKey);
  });
}

async function start(
  serverUrl: string,
  settings: TailscaleSettings,
  authKey?: string,
): Promise<string> {
  const port = await startTailscale({
    upstream: serverUrl,
    hostname: HOSTNAME,
    controlURL: settings.controlURL,
    authKey,
    port: GATEWAY_PORT,
  });
  lastControlURL = settings.controlURL;
  setRunningGateway({ serverUrl, port });
  const gateway = loopbackUrl(port);
  setServerAlias(serverUrl, gateway);
  setStatus(getTailscaleStatus());
  return gateway;
}

/** Leaves the tailnet until the next start. The node stays registered. */
export function stopGateway(): Promise<void> {
  return serially(stopRunning);
}

async function stopRunning(): Promise<void> {
  if (!runningGateway) return;
  setRunningGateway(null);
  setServerAlias(null);
  try {
    await stopTailscale();
  } finally {
    setStatus({ state: "Off" });
  }
}

/**
 * Removes this phone's node from the tailnet and deletes its keys, running or
 * not. Best effort: the keys go even when the tailnet can't be reached.
 */
export function forgetGateway(
  settings: TailscaleSettings | null,
): Promise<void> {
  return serially(async () => {
    setRunningGateway(null);
    setServerAlias(null);
    try {
      await forgetTailscale(settings?.controlURL ?? lastControlURL);
    } catch {
      // Nothing left to do: the keys are gone either way.
    } finally {
      setStatus({ state: "Off" });
    }
  });
}

export class TailscaleConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TailscaleConnectError";
  }
}

export function openTailscaleSignIn(): Promise<unknown> {
  return status.loginURL
    ? WebBrowser.openBrowserAsync(status.loginURL)
    : Promise.resolve(null);
}

type WaitOptions = {
  signal?: AbortSignal;
  /** Waits for the key to sign the node in before offering the sign-in page. */
  usingAuthKey?: boolean;
  timeoutMs?: number;
};

/**
 * Resolves once the node is on the tailnet. When it needs signing in, opens
 * Tailscale's sign-in page, and fails if that page closes without it.
 */
export function waitForTailnet({
  signal,
  usingAuthKey = false,
  timeoutMs = CONNECT_TIMEOUT_MS,
}: WaitOptions = {}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cleanups: (() => void)[] = [];
    let signInOpened = false;
    let signInAllowed = !usingAuthKey;
    let done = false;

    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      cleanups.forEach((cleanup) => cleanup());
      unsubscribe();
      signal?.removeEventListener("abort", onAbort);
      // Signed in: the page has nothing left to show. iOS only; Android's
      // Custom Tab is left for the user to close.
      if (!error && signInOpened) dismissSignIn();
      if (error) reject(error);
      else resolve();
    };
    // Signing in brings the node up within moments of the page closing.
    const settleAfterSignIn = () =>
      timers.push(
        setTimeout(
          () =>
            finish(
              new TailscaleConnectError("Tailscale sign-in wasn't finished."),
            ),
          SIGN_IN_SETTLE_MS,
        ),
      );
    const onAbort = () =>
      finish(new TailscaleConnectError("Joining the tailnet was cancelled."));

    const check = () => {
      const current = status;
      if (current.state === "Running") {
        finish();
        return;
      }
      if (current.state === "NeedsMachineAuth") {
        finish(
          new TailscaleConnectError(
            "An admin has to approve this phone in the Tailscale admin console. Try again once it's approved.",
          ),
        );
        return;
      }
      if (current.state === "Stopped" || current.state === "Off") {
        finish(
          new TailscaleConnectError(
            current.error
              ? `Tailscale stopped: ${current.error}`
              : "Tailscale stopped before joining the tailnet.",
          ),
        );
        return;
      }
      if (current.state !== "NeedsLogin" || !current.loginURL) return;
      // Once: the URL can change while the page is open.
      if (!signInAllowed || signInOpened) return;
      signInOpened = true;
      WebBrowser.openBrowserAsync(current.loginURL).then(
        (result) => {
          if (result.type !== "opened") {
            settleAfterSignIn();
            return;
          }
          // Android answers as soon as the Custom Tab opens. It has closed
          // once the app is back in front.
          let leftApp = false;
          const subscription = AppState.addEventListener("change", (next) => {
            if (next !== "active") {
              leftApp = true;
              return;
            }
            if (!leftApp) return;
            subscription.remove();
            settleAfterSignIn();
          });
          cleanups.push(() => subscription.remove());
        },
        () =>
          finish(
            new TailscaleConnectError(
              "Unable to open Tailscale's sign-in page.",
            ),
          ),
      );
    };

    const unsubscribe = subscribeToTailscaleStatus(check);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    timers.push(
      setTimeout(
        () =>
          finish(
            new TailscaleConnectError(
              "Timed out joining the tailnet. Check your connection and try again.",
            ),
          ),
        timeoutMs,
      ),
    );
    if (usingAuthKey) {
      timers.push(
        setTimeout(() => {
          if (status.state === "NeedsLogin") {
            finish(
              new TailscaleConnectError(
                status.error
                  ? `Tailscale didn't accept the auth key: ${status.error}`
                  : "Tailscale didn't accept the auth key.",
              ),
            );
          } else {
            signInAllowed = true;
            check();
          }
        }, AUTH_KEY_GRACE_MS),
      );
    }
    check();
  });
}

function dismissSignIn() {
  try {
    void Promise.resolve(WebBrowser.dismissBrowser()).catch(() => {});
  } catch {
    // No page open, or a platform without the call.
  }
}

/**
 * Opens Tailscale's sign-in page the first time a node restored at launch needs
 * one, as after it was removed from the tailnet. Returns a function to stop.
 */
export function signInWhenAsked(): () => void {
  let watching = true;
  const check = () => {
    if (!watching || status.state !== "NeedsLogin" || !status.loginURL) return;
    // Once a launch. Settings › Server can open it again.
    stop();
    void WebBrowser.openBrowserAsync(status.loginURL).catch(() => {});
  };
  const unsubscribe = subscribeToTailscaleStatus(check);
  const stop = () => {
    watching = false;
    unsubscribe();
  };
  check();
  return stop;
}
