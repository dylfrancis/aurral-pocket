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

// Cover Art Archive thumbnails, straight from the archive or through
// Lidarr's image cache: `<image id>-250.jpg`, `-500` or `-1200`.
const SIZED_ARCHIVE_COVER =
  /^(https?:\/\/(?:coverartarchive\.org\/release|imagecache\.lidarr\.audio\/v1\/caa)\/[^/?#]+\/[^/?#]+)-(?:250|500|1200)(\.[a-z]+)$/i;

/**
 * The full-size original of an archive cover thumbnail, or the URL itself for
 * anything else. The archive makes thumbnails some time after an upload, so a
 * new release's sized cover can 404 while the original loads.
 */
export function fullSizeCoverUrl(url: string): string {
  return url.replace(SIZED_ARCHIVE_COVER, "$1$2");
}
