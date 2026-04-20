import type { BasedOnArtist, DiscoveryArtist } from "@/lib/types/search";

const GENRE_SECTIONS_MAX = 4;
const GENRE_SECTION_MIN_ARTISTS = 4;
const GENRE_SECTION_MAX_ARTISTS = 6;

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

export function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
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

export function formatReleaseStatus(
  releaseDate?: string | null,
  today: Date = new Date(),
): string | null {
  const date = parseCalendarDate(releaseDate);
  if (!date) return null;
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const formatted = date.toLocaleDateString();
  if (date.getTime() === start.getTime()) return "Released today";
  if (date < start) return `Released ${formatted}`;
  return `Releasing ${formatted}`;
}
