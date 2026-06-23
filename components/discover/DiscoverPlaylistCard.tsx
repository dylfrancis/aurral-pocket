import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { FlowArtwork } from "@/components/flow/FlowArtwork";
import { useAuth } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { getDiscoverArtworkSource } from "@/lib/api/search";
import { playlistSourceLine } from "@/lib/discover/playlist-format";
import type { DiscoverPlaylist } from "@/lib/types/search";

const CARD_WIDTH = 150;
const ART_SIZE = CARD_WIDTH;

type Props = {
  playlist: DiscoverPlaylist;
  version?: string | null;
  onPress: () => void;
};

export function DiscoverPlaylistCard({ playlist, version, onPress }: Props) {
  const colors = Colors[useColorScheme()];
  const { token } = useAuth();
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const showArtwork =
    playlist.trackCount > 0 && playlist.hasArtwork !== false && !imageFailed;
  const artworkSource = getDiscoverArtworkSource(
    playlist.presetId,
    token,
    version,
  );
  const subtitle = playlistSourceLine(playlist);
  const adopted = !!playlist.adoptedFlowId || !!playlist.adoptedPlaylistId;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { width: CARD_WIDTH, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.artwork}>
        <FlowArtwork
          name={playlist.name}
          kind={playlist.type === "flow" ? "flow" : "playlist"}
          size={ART_SIZE}
          radius={10}
        />
        {showArtwork ? (
          <Image
            source={artworkSource}
            style={[StyleSheet.absoluteFill, { opacity: imageLoaded ? 1 : 0 }]}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        ) : null}
        {adopted ? (
          <View style={[styles.badge, { backgroundColor: colors.brand }]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.title, { color: colors.text }]}
        >
          {playlist.name}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            numberOfLines={2}
            style={{ color: colors.subtle }}
          >
            {subtitle}
          </Text>
        ) : (
          <Text variant="caption" style={{ color: colors.subtle }}>
            {playlist.trackCount} tracks
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  artwork: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 10,
    overflow: "hidden",
  },
  info: {
    paddingTop: 8,
    gap: 2,
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: Fonts.semiBold,
  },
});
