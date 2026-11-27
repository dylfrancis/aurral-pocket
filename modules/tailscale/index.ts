import {
  requireOptionalNativeModule,
  type EventSubscription,
} from "expo-modules-core";

/** "Off", or the Tailscale backend's own state. */
export type TailscaleState =
  | "Off"
  | "NoState"
  | "NeedsLogin"
  | "NeedsMachineAuth"
  | "Starting"
  | "Running"
  | "Stopped";

export type TailscaleStatus = {
  state: TailscaleState;
  /** Set while the node waits for someone to approve it in the browser. */
  loginURL?: string;
  port?: number;
  tailnetIPs?: string[];
  dnsName?: string;
  error?: string;
};

export type TailscaleStartOptions = {
  /** The server's tailnet URL. */
  upstream: string;
  hostname?: string;
  /** A Headscale server, or Tailscale's when left out. */
  controlURL?: string;
  /** Only read the first time. Left out, the node signs in in the browser. */
  authKey?: string;
  /** The loopback port to try first. */
  port?: number;
  verbose?: boolean;
};

type TailscaleNativeModule = {
  /** False in a build without the gateway library. */
  isAvailable: boolean;
  start(options: TailscaleStartOptions): Promise<number>;
  stop(): Promise<void>;
  forget(controlURL: string | null): Promise<void>;
  getStatus(): string;
  addListener(
    event: "onStatus",
    listener: (event: { status: string }) => void,
  ): EventSubscription;
};

/** Null on web and in Expo Go. */
const Tailscale =
  requireOptionalNativeModule<TailscaleNativeModule>("Tailscale");

export const isTailscaleAvailable = Tailscale?.isAvailable === true;

function parse(status: string): TailscaleStatus {
  return JSON.parse(status) as TailscaleStatus;
}

function required(): TailscaleNativeModule {
  if (!Tailscale || !isTailscaleAvailable) {
    throw new Error("Tailscale isn't available on this device.");
  }
  return Tailscale;
}

/** Resolves with the loopback port once it's open, before the node connects. */
export function startTailscale(
  options: TailscaleStartOptions,
): Promise<number> {
  return required().start(options);
}

/** Leaves the tailnet until the next start. The node stays registered. */
export function stopTailscale(): Promise<void> {
  return isTailscaleAvailable && Tailscale
    ? Tailscale.stop()
    : Promise.resolve();
}

/** Removes this phone's node from the tailnet and deletes its keys. */
export function forgetTailscale(controlURL?: string): Promise<void> {
  return isTailscaleAvailable && Tailscale
    ? Tailscale.forget(controlURL ?? null)
    : Promise.resolve();
}

export function getTailscaleStatus(): TailscaleStatus {
  return isTailscaleAvailable && Tailscale
    ? parse(Tailscale.getStatus())
    : { state: "Off" };
}

export function addTailscaleStatusListener(
  listener: (status: TailscaleStatus) => void,
): EventSubscription | null {
  if (!isTailscaleAvailable || !Tailscale) return null;
  return Tailscale.addListener("onStatus", ({ status }) =>
    listener(parse(status)),
  );
}
