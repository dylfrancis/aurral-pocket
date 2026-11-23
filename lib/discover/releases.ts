import { parseCalendarDate } from "@/lib/discover/format";
import { releaseRouteParams } from "@/lib/library-read";
import type { RecentReleaseAlbum } from "@/lib/types/search";

export type ReleaseMonthGroup = {
  label: string;
  releases: RecentReleaseAlbum[];
};

/**
 * The month heading a release sits under. Like the web, the year shows only
 * outside the current one.
 */
export function releaseMonthLabel(
  releaseDate: string | null,
  now: Date = new Date(),
): string {
  const date = parseCalendarDate(releaseDate);
  if (!date) return "Date to be announced";
  return date.toLocaleDateString(
    undefined,
    date.getFullYear() === now.getFullYear()
      ? { month: "long" }
      : { month: "long", year: "numeric" },
  );
}

/** Month groups in feed order, which the server already sorts by date. */
export function groupReleasesByMonth(
  releases: RecentReleaseAlbum[],
  now: Date = new Date(),
): ReleaseMonthGroup[] {
  const groups = new Map<string, RecentReleaseAlbum[]>();
  for (const release of releases) {
    const label = releaseMonthLabel(release.releaseDate, now);
    const group = groups.get(label);
    if (group) group.push(release);
    else groups.set(label, [release]);
  }
  return [...groups].map(([label, items]) => ({ label, releases: items }));
}

/**
 * Release page params with no Library artist id: a recommended artist's
 * release carries its MBID there, so the page looks the artist up.
 */
export function recentReleaseRouteParams(album: RecentReleaseAlbum) {
  return releaseRouteParams({
    mbid: album.mbid || album.foreignAlbumId || album.id,
    title: album.albumName || album.title || "",
    artistName: album.artistName,
    artistMbid: album.artistMbid || album.foreignArtistId,
    primaryType: album.albumType,
    secondaryTypes: album.secondaryTypes,
    releaseDate: album.releaseDate,
  });
}
