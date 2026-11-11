/**
 * React Native's `URL` does not parse, so this works on the string. Switching
 * to `URL` would pass under Jest, which has Node's real one, then silently
 * misread URLs on device.
 */
export function originOf(url: string): string {
  const match = /^(https?:\/\/[^/?#]+)/i.exec(url.trim());
  return match ? match[1].toLowerCase() : "";
}
