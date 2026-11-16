import React from "react";
import { MediaRow } from "@/components/ui/MediaRow";
import { AlbumSearchStatusBadge } from "./AlbumSearchStatusBadge";
import { releaseYear } from "@/lib/date-time";
import type { AlbumStatus, SearchAlbum } from "@/lib/types/search";

type SearchAlbumRowProps = {
  album: SearchAlbum;
  status: AlbumStatus;
  onPress: () => void;
};

function formatMeta(album: SearchAlbum) {
  const parts: string[] = [];
  const year = releaseYear(album.releaseDate);
  if (year) parts.push(String(year));
  if (album.primaryType) parts.push(album.primaryType);
  parts.push(...album.secondaryTypes);
  return parts.join(" · ");
}

export const SearchAlbumRow = React.memo(function SearchAlbumRow({
  album,
  status,
  onPress,
}: SearchAlbumRowProps) {
  return (
    <MediaRow
      imageType="album"
      mbid={album.id}
      title={album.title}
      subtitle={album.artistName}
      detail={formatMeta(album)}
      trailing={<AlbumSearchStatusBadge status={status} />}
      onPress={onPress}
    />
  );
});
