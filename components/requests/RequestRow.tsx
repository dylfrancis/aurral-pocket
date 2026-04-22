import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { RequestStatusBadge } from "./RequestStatusBadge";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { DownloadStatusValue } from "@/lib/types/library";
import type { Request } from "@/lib/types/requests";

type RequestRowProps = {
  request: Request;
  downloadStatus?: DownloadStatusValue;
  hasActions: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

export const RequestRow = React.memo(function RequestRow({
  request,
  downloadStatus,
  hasActions,
  onPress,
  onLongPress,
}: RequestRowProps) {
  const colors = Colors[useColorScheme()];

  const hasValidMbid =
    !!request.artistMbid &&
    request.artistMbid !== "null" &&
    request.artistMbid !== "undefined";

  const requestedLabel = new Date(request.requestedAt).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" },
  );

  const handleLongPress = () => {
    if (!hasActions) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  };

  return (
    <Pressable
      onPress={hasValidMbid ? onPress : undefined}
      onLongPress={hasActions ? handleLongPress : undefined}
      delayLongPress={300}
      disabled={!hasValidMbid && !hasActions}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.thumb}>
        {hasValidMbid ? (
          <CoverArtImage
            type="artist"
            mbid={request.artistMbid!}
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
              name="musical-notes-outline"
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
          {request.albumName}
        </Text>
        <View style={styles.statusRow}>
          <RequestStatusBadge
            request={request}
            downloadStatus={downloadStatus}
          />
        </View>
        <Text variant="caption" numberOfLines={1} style={styles.date}>
          {requestedLabel}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 12,
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
    fontFamily: Fonts.semiBold,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  date: {
    opacity: 0.7,
  },
});
