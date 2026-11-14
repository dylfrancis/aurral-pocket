import { StyleSheet, View } from "react-native";
import { AlbumCard } from "@/components/library/AlbumCard";
import { AlbumCategoryList } from "@/components/artist/AlbumCategoryList";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { EmptyState } from "@/components/library/EmptyState";
import { albumDownloadStatus } from "@/lib/library-read";
import { RELEASE_SECTIONS } from "@/lib/release-groups";
import type {
  Album,
  DownloadStatusMap,
  PrimaryReleaseType,
} from "@/lib/types/library";
import { SectionLabel } from "@/components/ui/SectionLabel";

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
  return (
    <View style={styles.container}>
      {isLoading ? (
        <>
          <SectionLabel style={styles.label}>In Your Library</SectionLabel>
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
          <SectionLabel style={styles.label}>In Your Library</SectionLabel>
          {RELEASE_SECTIONS.map(({ type, label }) => {
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
                    downloadStatus={albumDownloadStatus(
                      downloadStatuses,
                      album,
                    )}
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
    paddingHorizontal: 16,
    marginBottom: 4,
  },
});
