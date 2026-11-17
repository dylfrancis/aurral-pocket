import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const EDITORIAL_CARD_SIZE = 150;

type Props = {
  title: string;
  onNavigate?: () => void;
  children: ReactNode;
};

/** A titled row of Browse cards that scrolls sideways. */
export function EditorialRail({ title, onNavigate, children }: Props) {
  return (
    <View style={styles.container}>
      <SectionHeader title={title} onNavigate={onNavigate} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {children}
      </ScrollView>
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
