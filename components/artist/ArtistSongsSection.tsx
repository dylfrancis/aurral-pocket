import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  ArtistSongRow,
  type ArtistSong,
} from "@/components/artist/ArtistSongRow";
import { TopTracksSkeleton } from "@/components/artist/TopTracksSkeleton";
import { PillRow } from "@/components/ui/PillRow";
import type { PillRowItem } from "@/components/ui/pill-row";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ShowAllLink } from "@/components/ui/ShowAllLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { Fonts, Radius } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

const PLAY_ALL_PLACEHOLDER = { width: 68, height: 26 };
const ROWS_BEFORE_SHOW_ALL = 5;

type ArtistSongsSectionProps<Id extends string> = {
  title: string;
  /** Names what Play plays. */
  currentLabel: string;
  /** Empty for no pill row. */
  pills: readonly PillRowItem<Id>[];
  selected: Id | null;
  onSelect: (view: Id) => void;
  songs: ArtistSong[];
  isLoading?: boolean;
  /** The queue id of each row, in the same order. */
  itemIds: string[];
  currentId: string | null;
  isPlaying: boolean;
  onPlayFrom: (index: number) => void;
  onPlayAll: () => void;
  onOpenActions: (index: number) => void;
  onShowAll: () => void;
  /** The filter's menu button, beside Play. */
  filter?: ReactNode;
  /** Shown when the filter leaves nothing to list. */
  emptyMessage?: string | null;
};

export function ArtistSongsSection<Id extends string>({
  title,
  currentLabel,
  pills,
  selected,
  onSelect,
  songs,
  isLoading,
  itemIds,
  currentId,
  isPlaying,
  onPlayFrom,
  onPlayAll,
  onOpenActions,
  onShowAll,
  filter,
  emptyMessage,
}: ArtistSongsSectionProps<Id>) {
  const colors = useColors();

  if (isLoading) {
    return (
      <SectionFrame
        title={title}
        trailing={
          <Skeleton
            width={PLAY_ALL_PLACEHOLDER.width}
            height={PLAY_ALL_PLACEHOLDER.height}
            borderRadius={Radius.round}
          />
        }
      >
        <TopTracksSkeleton />
      </SectionFrame>
    );
  }

  // With pills, an empty view still lets the reader switch to another.
  if (songs.length === 0 && pills.length === 0) {
    // The filter stays reachable, so it can be turned back off.
    if (!emptyMessage) return null;
    return (
      <SectionFrame title={title} trailing={filter}>
        <Text variant="caption" style={styles.empty}>
          {emptyMessage}
        </Text>
      </SectionFrame>
    );
  }

  const playButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play ${currentLabel.toLowerCase()}`}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync();
        onPlayAll();
      }}
      style={({ pressed }) => [
        styles.playAll,
        { backgroundColor: colors.brandMuted, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name="play" size={13} color={colors.brandStrong} />
      <Text
        variant="caption"
        style={[styles.playAllLabel, { color: colors.brandStrong }]}
      >
        Play
      </Text>
    </Pressable>
  );

  return (
    <SectionFrame
      title={title}
      trailing={
        filter ? (
          <View style={styles.actions}>
            {playButton}
            {filter}
          </View>
        ) : (
          playButton
        )
      }
      pills={
        pills.length > 0 && selected ? (
          <PillRow
            items={pills}
            selected={selected}
            onSelect={onSelect}
            size="small"
          />
        ) : null
      }
    >
      {songs.slice(0, ROWS_BEFORE_SHOW_ALL).map((song, index) => (
        <ArtistSongRow
          key={song.key}
          song={song}
          number={index + 1}
          isCurrent={currentId !== null && itemIds[index] === currentId}
          isPlaying={isPlaying}
          onPress={() => {
            void Haptics.selectionAsync();
            onPlayFrom(index);
          }}
          onOpenActions={() => onOpenActions(index)}
        />
      ))}
      {songs.length > ROWS_BEFORE_SHOW_ALL ? (
        <ShowAllLink count={songs.length} onPress={onShowAll} />
      ) : null}
    </SectionFrame>
  );
}

/** The pill row runs to the screen's edges; the rest keeps the page margin. */
function SectionFrame({
  title,
  trailing,
  pills,
  children,
}: {
  title: string;
  trailing: ReactNode;
  pills?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SectionLabel>{title}</SectionLabel>
        {trailing}
      </View>
      {pills ? <View style={styles.pills}>{pills}</View> : null}
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  pills: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  rows: {
    paddingHorizontal: 16,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  empty: {
    paddingVertical: 12,
  },
  playAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.round,
  },
  playAllLabel: {
    ...Fonts.semiBold,
  },
});
