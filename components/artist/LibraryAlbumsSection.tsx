import { StyleSheet, View } from "react-native";
import { AlbumCard } from "@/components/library/AlbumCard";
import { AlbumCategoryList } from "@/components/artist/AlbumCategoryList";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { EmptyState } from "@/components/library/EmptyState";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type {
  Album,
  DownloadStatusMap,
  PrimaryReleaseType,
} from "@/lib/types/library";

const CATEGORIES: { type: PrimaryReleaseType; label: string }[] = [
  { type: "Album", label: "Albums" },
  { type: "EP", label: "EPs" },
  { type: "Single", label: "Singles" },
  { type: "Broadcast", label: "Broadcasts" },
  { type: "Other", label: "Other" },
];

type LibraryAlbumsSectionProps = {
  grouped: Map<PrimaryReleaseType, Album[]> | null;
  isLoading: boolean;
  error: unknown;
  downloadStatuses: DownloadStatusMap | undefined;
  onAlbumPress: (album: Album) => void;
  onNavigate?: (type: PrimaryReleaseType, label: string) => void;
  onRetry: () => void;
};

export function LibraryAlbumsSection({
  grouped,
  isLoading,
  error,
  downloadStatuses,
  onAlbumPress,
  onNavigate,
  onRetry,
}: LibraryAlbumsSectionProps) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      {isLoading ? (
        <>
          <Text
            variant="caption"
            style={[styles.label, { color: colors.subtle }]}
          >
            In Your Library
          </Text>
          <AlbumCategorySkeleton />
        </>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          message="Failed to load albums"
          actionLabel="Try Again"
          onAction={onRetry}
        />
      ) : grouped && grouped.size > 0 ? (
        <>
          <Text
            variant="caption"
            style={[styles.label, { color: colors.subtle }]}
          >
            In Your Library
          </Text>
          {CATEGORIES.map(({ type, label }) => {
            const list = grouped.get(type);
            if (!list || list.length === 0) return null;
            return (
              <AlbumCategoryList
                key={type}
                type={type}
                label={label}
                items={list}
                keyExtractor={(album) => album.id}
                renderItem={(album) => (
                  <AlbumCard
                    album={album}
                    onPress={() => onAlbumPress(album)}
                    downloadStatus={downloadStatuses?.[album.id]?.status}
                  />
                )}
                onNavigate={onNavigate}
              />
            );
          })}
        </>
      ) : (
        <EmptyState icon="disc-outline" message="No albums in library" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  label: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
});
