import { fullSizeCoverUrl } from "@/lib/url";

describe("fullSizeCoverUrl", () => {
  it.each([
    [
      "https://coverartarchive.org/release/r-1/123-1200.jpg",
      "https://coverartarchive.org/release/r-1/123.jpg",
    ],
    [
      "https://coverartarchive.org/release/r-1/123-250.jpg",
      "https://coverartarchive.org/release/r-1/123.jpg",
    ],
    [
      "https://imagecache.lidarr.audio/v1/caa/r-1/123-500.jpg",
      "https://imagecache.lidarr.audio/v1/caa/r-1/123.jpg",
    ],
  ])("strips the thumbnail size from %s", (thumbnail, original) => {
    expect(fullSizeCoverUrl(thumbnail)).toBe(original);
  });

  it.each([
    "https://coverartarchive.org/release/r-1/123.jpg",
    "https://coverartarchive.org/release-group/rg-1/front",
    "https://covers.example/release/r-1/123-1200.jpg",
    "/api/artists/release-group/rg-1/cover/image",
  ])("leaves %s alone", (url) => {
    expect(fullSizeCoverUrl(url)).toBe(url);
  });
});
