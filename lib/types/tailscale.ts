/** Saved for a server the app reaches through its own Tailscale node. */
export type TailscaleSettings = {
  /** A Headscale server, or Tailscale's when left out. */
  controlURL?: string;
};
