import { useItemActions } from "@/components/actions/item-actions-context";
import { formatCompactCount } from "@/lib/discover/trending-format";
import type { TrendingArtist } from "@/lib/types/search";
import { HorizontalArtistCard } from "./HorizontalArtistCard";

type Props = {
  artist: TrendingArtist;
  isInLibrary: boolean;
  onOpenArtist: (artist: TrendingArtist & { mbid: string }) => void;
};

/** A chart artist with its rank and fans, as the web shows it. */
export function TrendingArtistCard({
  artist,
  isInLibrary,
  onOpenArtist,
}: Props) {
  const { openArtist } = useItemActions();
  const { mbid } = artist;
  return (
    <HorizontalArtistCard
      mbid={mbid ?? ""}
      imageUrl={artist.imageUrl}
      name={artist.name}
      subtitle={
        artist.fans
          ? `No. ${artist.position} · ${formatCompactCount(artist.fans)} fans`
          : `No. ${artist.position}`
      }
      isInLibrary={isInLibrary}
      // Artists Aurral couldn't match to MusicBrainz have no page.
      onPress={mbid ? () => onOpenArtist({ ...artist, mbid }) : undefined}
      onLongPress={
        mbid
          ? () =>
              openArtist({
                ref: mbid,
                name: artist.name,
                coverUrl: artist.imageUrl,
              })
          : undefined
      }
    />
  );
}
