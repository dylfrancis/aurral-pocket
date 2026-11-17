import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { Fonts, Radius } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { describeActivityCause, formatCauseSince } from "@/lib/activity-views";
import type {
  ActivityCauseGroup,
  ActivityCauseKind,
} from "@/lib/types/activity";

const CARD_WIDTH = 168;
const BORDER_WIDTH = 2;

const CAUSE_ICONS: Record<ActivityCauseKind, keyof typeof Ionicons.glyphMap> = {
  request: "download-outline",
  monitoring: "notifications-outline",
  missing: "search-outline",
  upgrade: "trending-up-outline",
  flow: "pulse-outline",
  playlist: "list-outline",
  share: "share-outline",
};

type ActivityCauseCardsProps = {
  causes: readonly ActivityCauseGroup[];
  selected: string | null;
  /** Called with null when the selected card is tapped again. */
  onSelect: (key: string | null) => void;
  /** The list's side padding, which the strip scrolls past. */
  inset: number;
};

/** Why the queue's downloads were queued, one card per cause. */
export function ActivityCauseCards({
  causes,
  selected,
  onSelect,
  inset,
}: ActivityCauseCardsProps) {
  // Repaints the since-times when the server's date format changes.
  useDateTimeFormat();
  if (causes.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -inset }}
      contentContainerStyle={[styles.strip, { paddingHorizontal: inset }]}
      accessibilityLabel="Why downloads are queued"
    >
      {causes.map((group) => (
        <CauseCard
          key={group.key}
          group={group}
          isSelected={group.key === selected}
          onPress={() => {
            void Haptics.selectionAsync();
            onSelect(group.key === selected ? null : group.key);
          }}
        />
      ))}
    </ScrollView>
  );
}

function CauseCard({
  group,
  isSelected,
  onPress,
}: {
  group: ActivityCauseGroup;
  isSelected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const { title, why } = describeActivityCause(group);
  const since = formatCauseSince(group.since);
  const countLabel = since ? `${group.count} · since ${since}` : group.count;
  const accent = isSelected ? colors.brandStrong : colors.subtle;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={[
        title,
        why,
        `${group.count} ${group.count === 1 ? "download" : "downloads"}`,
        since ? `since ${since}` : null,
      ]
        .filter(Boolean)
        .join(", ")}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isSelected ? colors.brandMuted : colors.card,
          borderColor: isSelected ? colors.brand : "transparent",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.top}>
        <Ionicons name={CAUSE_ICONS[group.kind]} size={18} color={accent} />
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
        ) : null}
      </View>
      <Text
        variant="body"
        numberOfLines={1}
        style={[styles.title, { color: colors.text }]}
      >
        {title}
      </Text>
      <Text variant="caption" numberOfLines={1}>
        {why ?? " "}
      </Text>
      <Text
        variant="caption"
        numberOfLines={1}
        style={[styles.count, { color: accent }]}
      >
        {countLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: 8,
    paddingBottom: 12,
  },
  card: {
    width: CARD_WIDTH,
    padding: 12 - BORDER_WIDTH,
    borderWidth: BORDER_WIDTH,
    borderRadius: Radius.compact,
    gap: 2,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    ...Fonts.semiBold,
  },
  count: {
    fontVariant: ["tabular-nums"],
  },
});
