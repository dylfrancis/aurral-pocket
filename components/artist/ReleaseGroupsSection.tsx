import { StyleSheet, View } from "react-native";
import { ReleaseGroupCard } from "@/components/library/ReleaseGroupCard";
import { AlbumCategoryList } from "@/components/artist/AlbumCategoryList";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { RELEASE_SECTIONS } from "@/lib/release-groups";
import type { PrimaryReleaseType, ReleaseGroup } from "@/lib/types/library";
import { SectionLabel } from "@/components/ui/SectionLabel";

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
  if (!grouped || grouped.size === 0) {
    if (isLoading) {
      return (
        <View style={styles.container}>
          <SectionLabel style={styles.label}>Albums & Releases</SectionLabel>
          <AlbumCategorySkeleton />
        </View>
      );
    }
    return null;
  }

  return (
    <View style={styles.container}>
      <SectionLabel style={styles.label}>Albums & Releases</SectionLabel>
      {RELEASE_SECTIONS.map(({ type, label }) => {
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
    paddingHorizontal: 16,
    marginBottom: 4,
  },
});
