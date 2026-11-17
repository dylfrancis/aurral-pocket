import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { EmptyState } from "@/components/library/EmptyState";
import { PillRow } from "@/components/ui/PillRow";
import {
  useEditorialShelf,
  useOpenEditorialPlaylist,
} from "@/hooks/discover/use-editorial-playlists";
import { useColors } from "@/hooks/use-colors";
import { useGridColumns } from "@/hooks/use-grid-columns";
import { categoriesInGroup, isEditorialGroup } from "@/lib/discover/browse";
import { formatTrackCount } from "@/lib/discover/format";
import type { EditorialPlaylistSummary } from "@/lib/types/search";
import { EditorialCard } from "./EditorialCard";

const EDGE_PADDING = 16;
const CARD_GAP = 12;

type RouteParams = {
  group: string;
  category?: string;
  name?: string;
};

/**
 * One category's playlists, with the rest of its group as pills. The title is
 * the category, because a pill far down the row starts out of view.
 */
export function EditorialBrowseScreen() {
  const params = useLocalSearchParams<RouteParams>();
  const navigation = useNavigation();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const columns = useGridColumns(EDGE_PADDING * 2);
  const cardSize = Math.floor(
    (width - EDGE_PADDING * 2 - CARD_GAP * (columns - 1)) / columns,
  );

  const { data, isLoading, refetch } = useEditorialShelf();
  const openPlaylist = useOpenEditorialPlaylist();

  const group = isEditorialGroup(params.group) ? params.group : null;
  const categories = useMemo(
    () => (data && group ? categoriesInGroup(data.categories, group) : []),
    [data, group],
  );
  const [selectedId, setSelectedId] = useState(params.category);
  const selected =
    categories.find((category) => category.id === selectedId) ?? categories[0];

  const title = selected?.name ?? params.name;
  useEffect(() => {
    if (title) navigation.setOptions({ title });
  }, [navigation, title]);

  const background = { backgroundColor: colors.background };

  if (isLoading) {
    return (
      <View style={[styles.loading, background]}>
        <AlbumCategorySkeleton />
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.center, background]}>
        <EmptyState
          icon="cloud-offline-outline"
          message="Playlists didn't load"
          actionLabel="Try Again"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  if (!selected) {
    return (
      <View style={[styles.center, background]}>
        <EmptyState icon="list-outline" message="No playlists right now" />
      </View>
    );
  }

  return (
    <FlatList<EditorialPlaylistSummary>
      key={columns}
      data={selected.playlists}
      keyExtractor={(playlist) => `${playlist.provider}:${playlist.id}`}
      numColumns={columns}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.content, background]}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={
        <View style={styles.pills}>
          <PillRow
            items={categories.map((category) => ({
              id: category.id,
              label: category.name,
            }))}
            selected={selected.id}
            onSelect={setSelectedId}
          />
        </View>
      }
      renderItem={({ item: playlist }) => (
        <EditorialCard
          name={playlist.name}
          caption={formatTrackCount(playlist.trackCount)}
          artworkUrl={playlist.artworkUrl}
          size={cardSize}
          onPress={() => openPlaylist(playlist)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: EDGE_PADDING,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
  },
  row: {
    gap: CARD_GAP,
  },
  // The pills scroll edge to edge, past the grid's padding.
  pills: {
    marginHorizontal: -EDGE_PADDING,
  },
  loading: {
    flex: 1,
    paddingTop: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
