import React from "react";
import { Chip } from "@/components/ui/Chip";
import { MediaRow } from "@/components/ui/MediaRow";
import type { SearchArtist } from "@/lib/types/search";

type SearchArtistRowProps = {
  artist: SearchArtist;
  isInLibrary: boolean;
  onPress: () => void;
};

export const SearchArtistRow = React.memo(function SearchArtistRow({
  artist,
  isInLibrary,
  onPress,
}: SearchArtistRowProps) {
  return (
    <MediaRow
      imageType="artist"
      mbid={artist.id}
      title={artist.name}
      trailing={
        isInLibrary ? <Chip label="In Library" variant="brand" /> : undefined
      }
      onPress={onPress}
    />
  );
});
