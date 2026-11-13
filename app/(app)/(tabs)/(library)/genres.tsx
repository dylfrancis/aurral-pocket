import { useCallback, useMemo, useState } from "react";
import { useRouter, type ErrorBoundaryProps } from "expo-router";
import * as Burnt from "burnt";
import {
  GENRE_SORT_OPTIONS,
  type GenreSortMode,
} from "@/components/library/AlbumSortPicker";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { SEARCH_PLACEHOLDERS } from "@/constants/navigation";
import { MediaRow } from "@/components/ui/MediaRow";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { useLibraryGenres } from "@/hooks/library/use-library-genres";
import type { CanonicalGenre } from "@/lib/types/library";

const countLabel = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

type GenreComparator = (a: CanonicalGenre, b: CanonicalGenre) => number;

const byName: GenreComparator = (a, b) => a.name.localeCompare(b.name);

const mostFirst =
  (countField: "tracks" | "albums" | "artists"): GenreComparator =>
  (a, b) =>
    b[countField] - a[countField] || byName(a, b);

const GENRE_COMPARATORS: Record<GenreSortMode, GenreComparator> = {
  "name-asc": byName,
  "name-desc": (a, b) => byName(b, a),
  "most-tracks": mostFirst("tracks"),
  "most-albums": mostFirst("albums"),
  "most-artists": mostFirst("artists"),
};

export default function LibraryGenresScreen() {
  const router = useRouter();
  const { data: genres, refetch } = useLibraryGenres();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<GenreSortMode>("name-asc");

  const sortedGenres = useMemo(
    () => [...genres].sort(GENRE_COMPARATORS[sortMode]),
    [genres, sortMode],
  );
  const visibleGenres = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return sortedGenres.filter((genre) =>
      genre.name.toLocaleLowerCase().includes(query),
    );
  }, [sortedGenres, searchQuery]);

  // Its own flag, not isRefetching, so a refetch nobody pulled for shows no
  // spinner.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const result = await refetch();
    setRefreshing(false);
    if (result.isError) {
      Burnt.toast({ title: "Couldn't refresh genres", preset: "error" });
    }
  }, [refetch]);

  return (
    <ReleaseGrid
      items={visibleGenres}
      isLoading={false}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      sortMode={sortMode}
      onSortChange={setSortMode}
      sortOptions={GENRE_SORT_OPTIONS}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={SEARCH_PLACEHOLDERS.genres}
      hasUnderlyingItems={genres.length > 0}
      emptyMessage="No genres to show"
      emptyIcon="pricetags-outline"
      renderListItem={(genre) => (
        <MediaRow
          title={genre.name}
          subtitle={[
            countLabel(genre.artists, "artist"),
            countLabel(genre.albums, "album"),
            countLabel(genre.tracks, "track"),
          ].join(" · ")}
          // A param, not an interpolated path: a name holding `/` or `&` stays
          // one route segment.
          onPress={() =>
            router.push({
              pathname: "/genre/[genre]",
              params: { genre: genre.name },
            })
          }
        />
      )}
      keyExtractor={(genre) => genre.name}
    />
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load genres" />;
}
