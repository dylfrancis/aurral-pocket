import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { EmptyState } from "@/components/library/EmptyState";
import { useEditorialShelf } from "@/hooks/discover/use-editorial-playlists";
import { EditorialPlaylistRail } from "./EditorialPlaylistRail";

const SHELVES_ON_SCREEN = 3;

/** Not a FlatList: it sits inside Discover's scroll view. */
export function EditorialShelf() {
  const { data, isLoading, refetch } = useEditorialShelf();

  const shelves = useMemo(
    () =>
      data
        ? [
            ...(data.forYou.length > 0
              ? [{ key: "for-you", title: "For You", playlists: data.forYou }]
              : []),
            ...data.genres.map((genre) => ({
              key: String(genre.id),
              title: genre.name,
              playlists: genre.playlists,
            })),
          ]
        : [],
    [data],
  );

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

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <AlbumCategorySkeleton />
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.message}>
        <EmptyState
          icon="cloud-offline-outline"
          message="Playlists didn't load"
          actionLabel="Try Again"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  if (shelves.length === 0) {
    return (
      <View style={styles.message}>
        <EmptyState icon="list-outline" message="No playlists right now" />
      </View>
    );
  }

  return (
    <View style={styles.shelves}>
      {shelves.slice(0, builtShelfCount).map((shelf) => (
        <EditorialPlaylistRail
          key={shelf.key}
          title={shelf.title}
          playlists={shelf.playlists}
        />
      ))}
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
