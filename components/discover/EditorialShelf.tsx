import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { EmptyState } from "@/components/library/EmptyState";
import {
  useEditorialShelf,
  useMadeForYou,
} from "@/hooks/discover/use-editorial-playlists";
import { BROWSE_GROUPS, categoriesInGroup } from "@/lib/discover/browse";
import type {
  EditorialCategory,
  EditorialPlaylistSummary,
} from "@/lib/types/search";
import { EditorialCategoryRail } from "./EditorialCategoryRail";
import { EditorialPlaylistRail } from "./EditorialPlaylistRail";
import { MadeForYouSection } from "./MadeForYouSection";

const SHELVES_ON_SCREEN = 3;

type Shelf =
  | { key: string; title: string; playlists: EditorialPlaylistSummary[] }
  | { key: string; title: string; categories: EditorialCategory[] };

/** Not a FlatList: it sits inside Discover's scroll view. */
export function EditorialShelf() {
  const madeForYou = useMadeForYou();
  const { data, isLoading, refetch } = useEditorialShelf();

  const shelves = useMemo<Shelf[]>(() => {
    if (!data) return [];
    return [
      ...(data.forYou.length > 0
        ? [{ key: "for-you", title: "Your Genres", playlists: data.forYou }]
        : []),
      ...BROWSE_GROUPS.flatMap(({ group, title }) => {
        const categories = categoriesInGroup(data.categories, group);
        return categories.length > 0 ? [{ key: group, title, categories }] : [];
      }),
    ];
  }, [data]);

  // Building every rail's covers at once stalls the UI thread, so the rails
  // below the fold follow one per frame.
  const [builtShelfCount, setBuiltShelfCount] = useState(SHELVES_ON_SCREEN);
  useEffect(() => {
    if (builtShelfCount >= shelves.length) return;
    const frame = requestAnimationFrame(() =>
      setBuiltShelfCount((count) => count + 1),
    );
    return () => cancelAnimationFrame(frame);
  }, [builtShelfCount, shelves.length]);

  // Aurral builds Made for You itself, so it doesn't wait on Deezer.
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <MadeForYouSection />
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.shelves}>
        <MadeForYouSection />
        <View style={styles.message}>
          <EmptyState
            icon="cloud-offline-outline"
            message="Playlists didn't load"
            actionLabel="Try Again"
            onAction={() => void refetch()}
          />
        </View>
      </View>
    );
  }

  const noMadeForYou =
    !madeForYou.isLoading && (madeForYou.data?.length ?? 0) === 0;
  if (shelves.length === 0 && noMadeForYou) {
    return (
      <View style={styles.message}>
        <EmptyState icon="list-outline" message="No playlists right now" />
      </View>
    );
  }

  return (
    <View style={styles.shelves}>
      <MadeForYouSection />
      {shelves
        .slice(0, builtShelfCount)
        .map((shelf) =>
          "playlists" in shelf ? (
            <EditorialPlaylistRail
              key={shelf.key}
              title={shelf.title}
              playlists={shelf.playlists}
            />
          ) : (
            <EditorialCategoryRail
              key={shelf.key}
              title={shelf.title}
              categories={shelf.categories}
            />
          ),
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingTop: 16,
    gap: 16,
  },
  message: {
    paddingVertical: 48,
  },
  shelves: {
    gap: 12,
  },
});
