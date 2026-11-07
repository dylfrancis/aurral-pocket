import { FlatList, ScrollView, StyleSheet } from "react-native";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { EmptyState } from "@/components/library/EmptyState";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { Colors } from "@/constants/theme";
import { useEditorialShelf } from "@/hooks/discover/use-editorial-playlists";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { EditorialPlaylistRail } from "./EditorialPlaylistRail";

export function EditorialShelfScreen() {
  const colors = Colors[useColorScheme()];
  const { data, isLoading, refetch } = useEditorialShelf();

  if (isLoading) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        scrollEnabled={false}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.loading}
      >
        <AlbumCategorySkeleton />
        <AlbumCategorySkeleton />
      </ScrollView>
    );
  }

  if (!data) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="cloud-offline-outline"
          message="Playlists didn't load"
          actionLabel="Try Again"
          onAction={() => void refetch()}
        />
      </ScreenCenter>
    );
  }

  const shelves = [
    ...(data.forYou.length > 0
      ? [{ key: "for-you", title: "For You", playlists: data.forYou }]
      : []),
    ...data.genres.map((genre) => ({
      key: String(genre.id),
      title: genre.name,
      playlists: genre.playlists,
    })),
  ];

  return (
    <FlatList
      data={shelves}
      keyExtractor={(shelf) => shelf.key}
      renderItem={({ item: shelf }) => (
        <EditorialPlaylistRail
          title={shelf.title}
          playlists={shelf.playlists}
        />
      )}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      ListEmptyComponent={
        <EmptyState icon="list-outline" message="No playlists right now" />
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingTop: 16,
    gap: 16,
  },
  content: {
    paddingBottom: 32,
    gap: 12,
  },
});
