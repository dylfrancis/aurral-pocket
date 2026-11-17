import { useMemo } from "react";
import type { ErrorBoundaryProps } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { statusSection } from "@/components/library/LibraryListMenus";
import { ReleaseGrid } from "@/components/library/ReleaseGrid";
import { SongRow } from "@/components/library/SongRow";
import {
  TrackActionsSheet,
  useTrackActions,
} from "@/components/library/TrackActionsSheet";
import {
  menuOptionSection,
  type MenuOption,
} from "@/components/ui/MenuOptions";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { SEARCH_PLACEHOLDERS } from "@/constants/navigation";
import { albumTrackContext } from "@/hooks/library/album-track-context";
import type { LibraryShow } from "@/hooks/library/use-library-view";
import { usePlaySongs } from "@/hooks/library/use-play-songs";
import { useSongList } from "@/hooks/library/use-song-list";

const SHOW_OPTIONS: MenuOption<LibraryShow>[] = [
  { key: "all", label: "All Songs" },
  { key: "favorites", label: "Favorites" },
];

/** Every playable song in the Library, as rows. */
export default function LibrarySongsScreen() {
  const list = useSongList();
  const queryClient = useQueryClient();
  const trackActions = useTrackActions();
  const playSongs = usePlaySongs();

  const { show, setShow, status, setStatus } = list;
  const filterSections = useMemo(
    () => ({
      show: menuOptionSection("Show", SHOW_OPTIONS, show, setShow),
      status: statusSection(status, setStatus),
    }),
    [show, setShow, status, setStatus],
  );

  return (
    <ReleaseGrid
      items={list.items}
      isLoading={list.isLoading}
      refreshing={list.refreshing}
      onRefresh={list.handleRefresh}
      sortMode={list.sortMode}
      onSortChange={list.setSortMode}
      sortOptions={list.sortOptions}
      searchQuery={list.settledQuery}
      onSearchChange={list.setSearchQuery}
      searchPlaceholder={SEARCH_PLACEHOLDERS.songs}
      hasUnderlyingItems={list.hasUnderlyingItems}
      emptyMessage="No songs to show"
      emptyIcon="musical-notes-outline"
      onEndReached={list.loadMore}
      isFetchingNextPage={list.isFetchingNextPage}
      filterSections={filterSections}
      filtered={show !== "all" || status !== null}
      renderListItem={(song) => (
        <SongRow
          track={song}
          onPress={() => void playSongs(list.items, song)}
          onOpenActions={() =>
            trackActions.open(song, albumTrackContext(song, queryClient))
          }
        />
      )}
      keyExtractor={(song) => song.id}
      bottomSheet={
        <TrackActionsSheet
          target={trackActions.target}
          onClose={trackActions.close}
        />
      }
    />
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} message="Failed to load songs" />;
}
