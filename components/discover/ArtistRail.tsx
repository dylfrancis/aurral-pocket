import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { DiscoveryArtist } from "@/lib/types/search";
import { DiscoverRail } from "./DiscoverRail";
import {
  ARTIST_CARD_WIDTH,
  HorizontalArtistCard,
} from "./HorizontalArtistCard";

type Props = {
  title: string;
  accent?: ReactNode;
  artists: readonly DiscoveryArtist[];
  subtitle?: (artist: DiscoveryArtist) => string | undefined;
  isInLibrary: (mbid: string) => boolean;
  onArtistPress: (artist: DiscoveryArtist) => void;
  onViewAll?: () => void;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ArtistRail({
  title,
  accent,
  artists,
  subtitle,
  isInLibrary,
  onArtistPress,
  onViewAll,
  isLoading,
  style,
}: Props) {
  return (
    <DiscoverRail
      title={title}
      accent={accent}
      items={artists}
      keyOf={(artist) => artist.id || artist.name}
      renderItem={(artist) => (
        <HorizontalArtistCard
          mbid={artist.id}
          name={artist.name}
          subtitle={subtitle?.(artist)}
          isInLibrary={isInLibrary(artist.id)}
          onPress={() => onArtistPress(artist)}
        />
      )}
      cardSize={ARTIST_CARD_WIDTH}
      isLoading={isLoading}
      onViewAll={onViewAll}
      style={style}
    />
  );
}
