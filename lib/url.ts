/**
 * React Native's `URL` does not parse, so this works on the string. Switching
 * to `URL` would pass under Jest, which has Node's real one, then silently
 * misread URLs on device.
 */
export function originOf(url: string): string {
  const match = /^(https?:\/\/[^/?#]+)/i.exec(url.trim());
  return match ? match[1].toLowerCase() : "";
}

/** The host and port, which is what tells one server from another on screen. */
export function hostOf(url: string): string {
  return originOf(url).replace(/^https?:\/\//, "");
}
