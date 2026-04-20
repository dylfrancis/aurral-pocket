import { StyleSheet, View } from "react-native";
import { ReleaseGroupCard } from "@/components/library/ReleaseGroupCard";
import { AlbumCategoryList } from "@/components/artist/AlbumCategoryList";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { PrimaryReleaseType, ReleaseGroup } from "@/lib/types/library";

const CATEGORIES: { type: PrimaryReleaseType; label: string }[] = [
  { type: "Album", label: "Albums" },
  { type: "EP", label: "EPs" },
  { type: "Single", label: "Singles" },
  { type: "Broadcast", label: "Broadcasts" },
  { type: "Other", label: "Other" },
];

type ReleaseGroupsSectionProps = {
  grouped: Map<PrimaryReleaseType, ReleaseGroup[]> | null;
  isLoading?: boolean;
  onPress: (rg: ReleaseGroup) => void;
  onNavigate: (type: PrimaryReleaseType, label: string) => void;
};

export function ReleaseGroupsSection({
  grouped,
  isLoading,
  onPress,
  onNavigate,
}: ReleaseGroupsSectionProps) {
  const colors = Colors[useColorScheme()];

  if (isLoading && !grouped) {
    return (
      <View style={styles.container}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Albums & Releases
        </Text>
        <AlbumCategorySkeleton />
      </View>
    );
  }

  if (!grouped || grouped.size === 0) return null;

  return (
    <View style={styles.container}>
      <Text variant="caption" style={[styles.label, { color: colors.subtle }]}>
        Albums & Releases
      </Text>
      {CATEGORIES.map(({ type, label }) => {
        const list = grouped.get(type);
        if (!list || list.length === 0) return null;
        return (
          <AlbumCategoryList
            key={`rg-${type}`}
            type={type}
            label={label}
            items={list}
            keyExtractor={(rg) => rg.id}
            renderItem={(rg) => (
              <ReleaseGroupCard releaseGroup={rg} onPress={() => onPress(rg)} />
            )}
            onNavigate={onNavigate}
          />
        );
      })}
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
