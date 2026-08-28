import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { ActivityStatusBadge } from "./ActivityStatusBadge";
import { ReviewActions } from "./ReviewActions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { formatDate } from "@/lib/date-time";
import { Colors, Fonts } from "@/constants/theme";
import type { DownloadStatusValue } from "@/lib/types/library";
import {
  historyArtistMbid,
  isAlbumRequest,
  type ActivityHistoryItem,
  type ActivityItem,
} from "@/lib/types/activity";

const KIND_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  artist_added: "person-add-outline",
  track_download: "cloud-download-outline",
  track_reused_lidarr: "repeat-outline",
  album_requested: "musical-notes-outline",
};

function fallbackIcon(item: ActivityItem): keyof typeof Ionicons.glyphMap {
  if (isAlbumRequest(item)) return "musical-notes-outline";
  return KIND_ICONS[item.kind ?? ""] ?? "pulse-outline";
}

/**
 * Album requests title on the album; history entries arrive with the server's
 * own pre-rendered title/subtitle, so they are shown verbatim.
 */
function primaryText(item: ActivityItem): string {
  return isAlbumRequest(item) ? item.albumName : item.title;
}

function secondaryText(item: ActivityItem): string | null {
  if (isAlbumRequest(item)) return item.artistName || null;
  // A blocked job's subtitle says little; the staged filename is what the user
  // needs in order to decide whether to approve it.
  if (item.status === "blocked" && item.sourceFilename) {
    return item.sourceFilename;
  }
  return item.subtitle;
}

/** Blocked jobs are the only rows that carry an inline decision. */
function reviewJobId(item: ActivityItem): string | null {
  if (isAlbumRequest(item)) return null;
  return item.status === "blocked" && item.jobId ? item.jobId : null;
}

/**
 * Only rows that resolve an artist MBID can navigate — album requests carry one
 * directly, history entries only via their href.
 */
function artistMbidFor(item: ActivityItem): string | null {
  if (isAlbumRequest(item)) {
    const mbid = item.artistMbid;
    if (!mbid || mbid === "null" || mbid === "undefined") return null;
    return mbid;
  }
  return historyArtistMbid(item as ActivityHistoryItem);
}

type ActivityRowProps = {
  item: ActivityItem;
  downloadStatus?: DownloadStatusValue;
  hasActions: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

export const ActivityRow = React.memo(function ActivityRow({
  item,
  downloadStatus,
  hasActions,
  onPress,
  onLongPress,
}: ActivityRowProps) {
  const colors = Colors[useColorScheme()];
  // This row is memoized, so subscribe here: a changed server format has to
  // repaint the date even when the item props stay the same.
  useDateTimeFormat();

  const artistMbid = artistMbidFor(item);
  const requestedLabel = formatDate(new Date(item.requestedAt), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const subtitle = secondaryText(item);
  const jobId = reviewJobId(item);

  const handleLongPress = () => {
    if (!hasActions) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onLongPress();
  };

  return (
    <Card
      onPress={artistMbid ? onPress : undefined}
      onLongPress={hasActions ? handleLongPress : undefined}
      delayLongPress={300}
      disabled={!artistMbid && !hasActions}
      style={styles.row}
    >
      <View style={styles.thumb}>
        {artistMbid ? (
          <CoverArtImage
            type="artist"
            mbid={artistMbid}
            size={56}
            borderRadius={8}
          />
        ) : (
          <View
            style={[
              styles.thumbPlaceholder,
              { backgroundColor: colors.separator, borderRadius: 8 },
            ]}
          >
            <Ionicons
              name={fallbackIcon(item)}
              size={22}
              color={colors.subtle}
            />
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.title, { color: colors.text }]}
        >
          {primaryText(item)}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: colors.subtle }}
          >
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.statusRow}>
          <ActivityStatusBadge item={item} downloadStatus={downloadStatus} />
        </View>
        <Text variant="caption" numberOfLines={1} style={styles.date}>
          {requestedLabel}
        </Text>
        {jobId ? <ReviewActions jobId={jobId} /> : null}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
  },
  thumb: {
    width: 56,
    height: 56,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  date: {
    opacity: 0.7,
  },
});
