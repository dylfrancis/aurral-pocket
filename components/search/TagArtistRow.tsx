import React from "react";
import { Chip } from "@/components/ui/Chip";
import { MediaRow } from "@/components/ui/MediaRow";
import type { TagArtist } from "@/lib/types/search";

type TagArtistRowProps = {
  artist: TagArtist;
  isInLibrary: boolean;
  onPress: () => void;
};

export const TagArtistRow = React.memo(function TagArtistRow({
  artist,
  isInLibrary,
  onPress,
}: TagArtistRowProps) {
  return (
    <MediaRow
      imageType="artist"
      mbid={artist.id}
      title={artist.name}
      subtitle={
        artist.tags.length > 1 ? artist.tags.slice(0, 3).join(" · ") : undefined
      }
      trailing={
        isInLibrary ? <Chip label="In Library" variant="brand" /> : undefined
      }
      onPress={onPress}
    />
  );
});
