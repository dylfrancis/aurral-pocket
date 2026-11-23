import React from "react";
import { Chip } from "@/components/ui/Chip";
import { MediaRow } from "@/components/ui/MediaRow";
import type { SearchArtist } from "@/lib/types/search";

type SearchArtistRowProps = {
  artist: SearchArtist;
  isInLibrary: boolean;
  /** Server-relative Library artwork, for a Library artist. */
  image?: string | null;
  onPress: () => void;
  /** Opens the artist's actions. */
  onLongPress?: () => void;
};

export const SearchArtistRow = React.memo(function SearchArtistRow({
  artist,
  isInLibrary,
  image,
  onPress,
  onLongPress,
}: SearchArtistRowProps) {
  return (
    <MediaRow
      imageType="artist"
      mbid={artist.id}
      coverUrl={image ?? undefined}
      title={artist.name}
      trailing={
        isInLibrary ? <Chip label="In Library" variant="brand" /> : undefined
      }
      onPress={onPress}
      onLongPress={onLongPress}
    />
  );
});
