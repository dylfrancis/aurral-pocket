import { Fragment, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ViewAllCard } from "./ViewAllCard";

/** Cards a rail shows before its View All card. */
const MAX_VISIBLE = 12;

type DiscoverRailProps<T> = {
  title: string;
  /** Drawn after the title, like a genre rail's tag. */
  accent?: ReactNode;
  items: readonly T[];
  keyOf: (item: T, index: number) => string;
  renderItem: (item: T) => ReactNode;
  /** The cards' width, so the View All card matches them. */
  cardSize: number;
  isLoading?: boolean;
  onViewAll?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * A titled horizontal row of cards for Discover. It keeps the same header
 * while loading, and renders nothing once loaded with no items.
 */
export function DiscoverRail<T>({
  title,
  accent,
  items,
  keyOf,
  renderItem,
  cardSize,
  isLoading = false,
  onViewAll,
  style,
}: DiscoverRailProps<T>) {
  if (!isLoading && items.length === 0) return null;

  return (
    <View style={style}>
      <SectionHeader title={title} accent={accent} onNavigate={onViewAll} />
      {isLoading ? (
        <AlbumCategorySkeleton />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {items.slice(0, MAX_VISIBLE).map((item, index) => (
            <Fragment key={keyOf(item, index)}>{renderItem(item)}</Fragment>
          ))}
          {items.length > MAX_VISIBLE && onViewAll ? (
            <ViewAllCard size={cardSize} onPress={onViewAll} />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
});
