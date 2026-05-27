import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  missingCount?: number;
  isResearching?: boolean;
  onResearchMissing?: () => void;
};

export function LibraryAlbumsSection({
  grouped,
  isLoading,
  error,
  downloadStatuses,
  onAlbumPress,
  onNavigate,
  onRetry,
  missingCount = 0,
  isResearching = false,
  onResearchMissing,
}: LibraryAlbumsSectionProps) {
  const colors = Colors[useColorScheme()];

  const showResearch = missingCount > 0 && !!onResearchMissing;

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
          <View style={styles.headerRow}>
            <Text
              variant="caption"
              style={[styles.label, { color: colors.subtle }]}
            >
              In Your Library
            </Text>
            {showResearch && (
              <Pressable
                onPress={onResearchMissing}
                disabled={isResearching}
                accessibilityRole="button"
                accessibilityLabel={`Re-search ${missingCount} missing ${
                  missingCount === 1 ? "album" : "albums"
                }`}
                style={({ pressed }) => [
                  styles.researchButton,
                  { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {isResearching ? (
                  <ActivityIndicator size={14} color={colors.brand} />
                ) : (
                  <Ionicons name="search" size={14} color={colors.brand} />
                )}
                <Text variant="caption" style={{ color: colors.text }}>
                  Re-search Missing ({missingCount})
                </Text>
              </Pressable>
            )}
          </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  researchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginRight: 16,
  },
});
