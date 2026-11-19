import { useQueryClient } from "@tanstack/react-query";
import { CollectionArtwork } from "@/components/flow/CollectionArtwork";
import { MediaRow } from "@/components/ui/MediaRow";
import { flowStatusQueryOptions } from "@/hooks/flow/use-flow-status";
import type { LibrarySearchPlaylist } from "@/lib/types/search";

const ARTWORK_SIZE = 56;

/** Flows and static playlists can share an id. */
export function searchPlaylistKey(playlist: LibrarySearchPlaylist) {
  return `${playlist.sourceFlowId ? "flow" : "playlist"}:${playlist.id}`;
}

export function searchPlaylistHref(playlist: LibrarySearchPlaylist) {
  return playlist.sourceFlowId
    ? { pathname: "/flow/[id]" as const, params: { id: playlist.sourceFlowId } }
    : { pathname: "/playlist/[id]" as const, params: { id: playlist.id } };
}

function kindLabel(playlist: LibrarySearchPlaylist) {
  if (playlist.sourceFlowId) return "Flow";
  const count = playlist.trackCount;
  if (count == null) return "Playlist";
  return `Playlist · ${count} track${count === 1 ? "" : "s"}`;
}

/** Which of the playlist's songs matched, as the web words it. */
function matchLabel(playlist: LibrarySearchPlaylist) {
  const match = playlist.trackMatch;
  if (!match) return undefined;
  const more = match.count - 1;
  return more > 0
    ? `Has ${match.title} and ${more} more`
    : `Has ${match.title}`;
}

export function SearchPlaylistRow({
  playlist,
  onPress,
}: {
  playlist: LibrarySearchPlaylist;
  onPress: () => void;
}) {
  const isFlow = !!playlist.sourceFlowId;
  const id = playlist.sourceFlowId ?? playlist.id;
  // Search sends no artwork revision. Read from the cache, so Search doesn't
  // keep flow status live the way the Flows screen does.
  const flowStatus = useQueryClient().getQueryData(
    flowStatusQueryOptions().queryKey,
  );
  const artworkRevision = (
    isFlow ? flowStatus?.flows : flowStatus?.staticPlaylists
  )?.find((entry) => entry.id === id)?.artworkRevision;
  return (
    <MediaRow
      image={
        <CollectionArtwork
          collection={{
            id,
            name: playlist.name,
            artworkRevision,
            trackCount: playlist.trackCount ?? undefined,
          }}
          kind={isFlow ? "flow" : "playlist"}
          size={ARTWORK_SIZE}
          radius={6}
        />
      }
      title={playlist.name}
      subtitle={kindLabel(playlist)}
      detail={matchLabel(playlist)}
      onPress={onPress}
    />
  );
}
