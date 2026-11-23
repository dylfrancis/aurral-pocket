import { formatDate } from "@/lib/date-time";
import type {
  BasedOnArtist,
  DiscoveryArtist,
  RecentlyAddedArtist,
} from "@/lib/types/search";

const GENRE_SECTIONS_MAX = 4;
const GENRE_SECTION_MIN_ARTISTS = 4;
const GENRE_SECTION_MAX_ARTISTS = 6;

/** The id a Recently Added entry's artist image is looked up by. */
export function recentlyAddedMbid(artist: RecentlyAddedArtist): string {
  return artist.mbid || artist.foreignArtistId || artist.id;
}

export function formatTrackCount(count: number): string {
  if (count <= 0) return "";
  return `${count} track${count === 1 ? "" : "s"}`;
}

export function formatPlaylistCount(count: number): string {
  if (count <= 0) return "";
  return `${count} playlist${count === 1 ? "" : "s"}`;
}

export type GenreSection = {
  genre: string;
  artists: DiscoveryArtist[];
};

export function buildGenreSections(
  topGenres: string[],
  recommendations: DiscoveryArtist[],
): GenreSection[] {
  if (!topGenres.length || !recommendations.length) return [];

  const sections: GenreSection[] = [];
  const usedArtistIds = new Set<string>();
  const sortedGenres = [...topGenres].sort((a, b) => a.localeCompare(b));

  for (const genre of sortedGenres) {
    if (sections.length >= GENRE_SECTIONS_MAX) break;
    const needle = genre.toLowerCase();

    const genreArtists = recommendations.filter((artist) => {
      if (usedArtistIds.has(artist.id)) return false;
      const tags = artist.tags || [];
      return tags.some((tag) => tag.toLowerCase().includes(needle));
    });

    if (genreArtists.length >= GENRE_SECTION_MIN_ARTISTS) {
      const selected = genreArtists.slice(0, GENRE_SECTION_MAX_ARTISTS);
      selected.forEach((a) => usedArtistIds.add(a.id));
      sections.push({ genre, artists: selected });
    }
  }

  return sections;
}

export function formatBasedOn(artists: BasedOnArtist[]): string | null {
  const names = artists.map((a) => a.name).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return `Based on ${names[0]}`;
  if (names.length === 2) return `Based on ${names[0]} and ${names[1]}`;
  const others = names.length - 2;
  return `Based on ${names[0]}, ${names[1]} and ${others} other artist${
    others === 1 ? "" : "s"
  }`;
}

export function parseCalendarDate(value?: string | null): Date | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The web's Intl.RelativeTimeFormat day wording ("3 days ago", "last week"),
 * spelled out because Hermes has no RelativeTimeFormat.
 */
function formatDaysAgo(date: Date, today: Date): string {
  const days = Math.round(
    (startOfDay(today).getTime() - startOfDay(date).getTime()) / DAY_MS,
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const [count, unit] =
    days < 30
      ? [Math.round(days / 7), "week"]
      : days < 365
        ? [Math.round(days / 30), "month"]
        : [Math.round(days / 365), "year"];
  return count === 1 ? `last ${unit}` : `${count} ${unit}s ago`;
}

/** "Released 3 days ago" or "Releasing 12/5/2026", as the web's release cards write it. */
export function formatReleaseStatus(
  releaseDate?: string | null,
  today: Date = new Date(),
): string | null {
  const date = parseCalendarDate(releaseDate);
  if (!date) return null;
  if (date > startOfDay(today)) return `Releasing ${formatDate(date)}`;
  return `Released ${formatDaysAgo(date, today)}`;
}
