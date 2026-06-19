import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useDiscovery } from "@/hooks/discover";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import type { DiscoverPlaylist } from "@/lib/types/search";
import { DiscoverPlaylistCard } from "./DiscoverPlaylistCard";
import { DiscoverPlaylistSheet } from "./DiscoverPlaylistSheet";

export function DiscoverPlaylistsSection() {
  const colors = Colors[useColorScheme()];
  const { data } = useDiscovery();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [active, setActive] = useState<DiscoverPlaylist | null>(null);

  const playlists = data?.discoverPlaylists ?? [];
  const updating = data?.playlistsUpdating ?? false;
  const version = data?.lastUpdated;

  if (playlists.length === 0 && !updating) return null;

  const openPlaylist = (playlist: DiscoverPlaylist) => {
    setActive(playlist);
    sheetRef.current?.present();
  };

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Playlists for You"
        trailing={
          updating ? (
            <ActivityIndicator size="small" color={colors.subtle} />
          ) : undefined
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {playlists.map((playlist) => (
          <DiscoverPlaylistCard
            key={playlist.presetId}
            playlist={playlist}
            version={version}
            onPress={() => openPlaylist(playlist)}
          />
        ))}
      </ScrollView>
      <DiscoverPlaylistSheet
        sheetRef={sheetRef}
        playlist={active}
        onClose={() => setActive(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
});
