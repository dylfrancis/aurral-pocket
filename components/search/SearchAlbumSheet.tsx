import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { AlbumSearchStatusBadge } from "./AlbumSearchStatusBadge";
import {
  addLibraryAlbum,
  getReleaseGroupTracks,
  requestAlbumFromSearch,
  searchDeezerAlbum,
  triggerAlbumSearch,
  type ReleaseGroupTrack,
} from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import { useAudioPreview } from "@/hooks/library/use-audio-preview";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import { ApiError } from "@/lib/api/client";
import type { SearchAlbum } from "@/lib/types/search";

type Props = {
  album: SearchAlbum | null;
  sheetRef: React.RefObject<BottomSheet | null>;
};

const ACTIVE_STATUSES: ReadonlySet<SearchAlbum["status"]> = new Set([
  "searching",
  "downloading",
  "processing",
]);

function formatDuration(ms: number | null) {
  if (!ms) return null;
  const totalSeconds = Math.round(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function describeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return "Album already exists in Lidarr under a different artist.";
    }
    if (error.status === 503) {
      return error.message || "Lidarr is not configured.";
    }
    if (error.status === 403) {
      return "You don't have permission to add albums.";
    }
    return error.message || "Failed to add album.";
  }
  return "Failed to add album.";
}

export function SearchAlbumSheet({ album, sheetRef }: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const hasPermission = useHasPermission();
  const { libraryArtists } = useLibraryLookup();
  const canAddAlbum = hasPermission("addAlbum");

  const libraryArtistId = album?.artistMbid
    ? (libraryArtists?.find((a) => a.mbid === album.artistMbid)?.id ?? null)
    : null;

  const { data: tracks, isLoading: tracksLoading } = useQuery({
    queryKey: libraryKeys.releaseGroupTracks(album?.id ?? ""),
    queryFn: async () => {
      const deezerId = await searchDeezerAlbum(album!.artistName, album!.title);
      return getReleaseGroupTracks(album!.id, deezerId ?? undefined);
    },
    enabled: !!album,
    staleTime: 10 * 60 * 1000,
  });

  const {
    playingId,
    progress,
    toggle: toggleAudio,
    stop: stopPreview,
  } = useAudioPreview();

  useEffect(() => {
    stopPreview();
  }, [album?.id, stopPreview]);

  const invalidateAfterMutation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: libraryKeys.artists() });
    queryClient.invalidateQueries({ queryKey: ["search", "albums"] });
    queryClient.invalidateQueries({
      queryKey: libraryKeys.downloadStatusesAll(),
    });
  }, [queryClient]);

  const addAlbumMutation = useMutation({
    mutationFn: async () => {
      if (!album) throw new Error("No album selected");
      if (libraryArtistId) {
        await addLibraryAlbum(libraryArtistId, album.id, album.title);
        return { createdArtist: false };
      }
      if (!album.artistMbid) {
        throw new Error("Cannot add album without an artist reference");
      }
      const r = await requestAlbumFromSearch({
        albumMbid: album.id,
        albumName: album.title,
        artistMbid: album.artistMbid,
        artistName: album.artistName,
      });
      return { createdArtist: !!r.createdArtist };
    },
    onSuccess: ({ createdArtist }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateAfterMutation();
      sheetRef.current?.close();
      if (createdArtist) {
        Alert.alert(
          "Album added",
          `${album?.artistName} was also added to your library.`,
        );
      }
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Couldn't add album", describeError(error));
    },
  });

  const researchMutation = useMutation({
    mutationFn: async () => {
      if (!album?.libraryAlbumId) {
        throw new Error("No library album to re-search");
      }
      await triggerAlbumSearch(album.libraryAlbumId);
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      invalidateAfterMutation();
      sheetRef.current?.close();
    },
    onError: (error) => {
      Alert.alert("Couldn't trigger search", describeError(error));
    },
  });

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) stopPreview();
    },
    [stopPreview],
  );

  const togglePreview = useCallback(
    (track: ReleaseGroupTrack) => {
      const trackId = track.id ?? track.mbid ?? `${track.number}`;
      if (!track.preview_url) return;
      toggleAudio(trackId, track.preview_url);
    },
    [toggleAudio],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const year = album?.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;
  const typeLabel =
    album && album.secondaryTypes.length > 0
      ? `${album.primaryType ?? "Album"} · ${album.secondaryTypes.join(", ")}`
      : (album?.primaryType ?? "Album");

  const willCreateArtist =
    !!album && album.status === "missing" && !libraryArtistId;

  const action = resolveAction({
    album,
    canAddAlbum,
    isPending: addAlbumMutation.isPending || researchMutation.isPending,
  });

  const onActionPress = () => {
    if (action.kind === "add") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addAlbumMutation.mutate();
    } else if (action.kind === "research") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      researchMutation.mutate();
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["60%", "90%"]}
      enablePanDownToClose
      enableDynamicSizing={false}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.subtle }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {album && (
          <>
            <View style={styles.header}>
              <CoverArtImage
                type="album"
                mbid={album.id}
                size={120}
                borderRadius={10}
              />
              <View style={styles.headerMeta}>
                <Text variant="title" style={styles.albumName}>
                  {album.title}
                </Text>
                <Text variant="caption" style={{ color: colors.subtle }}>
                  {album.artistName}
                </Text>
                <Text variant="caption" style={{ color: colors.subtle }}>
                  {[year, typeLabel, tracks ? `${tracks.length} tracks` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <AlbumSearchStatusBadge status={album.status} />
              </View>
            </View>

            <View style={[styles.actions, { borderColor: colors.separator }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    backgroundColor: action.disabled
                      ? colors.separator
                      : colors.brand,
                    opacity: pressed && !action.disabled ? 0.85 : 1,
                  },
                ]}
                onPress={onActionPress}
                disabled={action.disabled}
              >
                {action.busy ? (
                  <ActivityIndicator size={18} color="#fff" />
                ) : (
                  <Ionicons name={action.icon} size={18} color="#fff" />
                )}
                <Text variant="body" style={styles.actionButtonText}>
                  {action.label}
                </Text>
              </Pressable>
              {willCreateArtist && canAddAlbum && (
                <Text
                  variant="caption"
                  style={[styles.callout, { color: colors.subtle }]}
                >
                  This will also add {album.artistName} to your library.
                </Text>
              )}
            </View>

            <View style={styles.trackSection}>
              <Text
                variant="subtitle"
                style={[styles.trackHeader, { color: colors.text }]}
              >
                Tracks
              </Text>
              {tracksLoading ? (
                <ActivityIndicator style={styles.loader} color={colors.brand} />
              ) : tracks && tracks.length > 0 ? (
                tracks.map((track, i) => {
                  const trackId = track.id ?? track.mbid ?? `${track.number}`;
                  const isPlaying = playingId === trackId;
                  return (
                    <TrackPreviewRow
                      key={`${track.number}-${i}`}
                      track={track}
                      hasPreview={!!track.preview_url}
                      isPlaying={isPlaying}
                      progress={isPlaying ? progress : 0}
                      onToggle={() => togglePreview(track)}
                    />
                  );
                })
              ) : (
                <Text variant="caption" style={styles.emptyText}>
                  No tracks available
                </Text>
              )}
            </View>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

type ActionState = {
  kind: "add" | "research" | "none";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  busy: boolean;
};

function resolveAction({
  album,
  canAddAlbum,
  isPending,
}: {
  album: SearchAlbum | null;
  canAddAlbum: boolean;
  isPending: boolean;
}): ActionState {
  if (!album) {
    return {
      kind: "none",
      label: "Add Album",
      icon: "add",
      disabled: true,
      busy: false,
    };
  }
  if (!canAddAlbum) {
    return {
      kind: "none",
      label: "No Access",
      icon: "lock-closed",
      disabled: true,
      busy: false,
    };
  }
  if (isPending) {
    return {
      kind: "none",
      label: "Working…",
      icon: "sync-outline",
      disabled: true,
      busy: true,
    };
  }
  if (ACTIVE_STATUSES.has(album.status)) {
    return {
      kind: "none",
      label: "Searching…",
      icon: "sync-outline",
      disabled: true,
      busy: true,
    };
  }
  if (album.status === "available") {
    return {
      kind: "none",
      label: "In Library",
      icon: "checkmark",
      disabled: true,
      busy: false,
    };
  }
  if (album.status === "inLibrary" && album.libraryAlbumId) {
    return {
      kind: "research",
      label: "Search Album",
      icon: "search",
      disabled: false,
      busy: false,
    };
  }
  return {
    kind: "add",
    label: "Add Album",
    icon: "add",
    disabled: false,
    busy: false,
  };
}

const TrackPreviewRow = React.memo(function TrackPreviewRow({
  track,
  hasPreview,
  isPlaying,
  progress,
  onToggle,
}: {
  track: ReleaseGroupTrack;
  hasPreview: boolean;
  isPlaying: boolean;
  progress: number;
  onToggle: () => void;
}) {
  const colors = Colors[useColorScheme()];
  const duration = formatDuration(track.length);
  const trackNum = track.trackNumber ?? track.position ?? track.number;

  return (
    <View style={[styles.trackRow, { borderBottomColor: colors.separator }]}>
      <Text
        variant="caption"
        style={[styles.trackNumber, { color: colors.subtle }]}
      >
        {trackNum}
      </Text>
      {hasPreview && (
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [
            styles.playButton,
            {
              backgroundColor: isPlaying ? colors.brand : colors.separator,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={12}
            color={isPlaying ? "#fff" : colors.text}
            style={isPlaying ? undefined : styles.playIcon}
          />
        </Pressable>
      )}
      <View style={styles.trackMeta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[
            styles.trackTitle,
            isPlaying && { color: colors.brandStrong },
          ]}
        >
          {track.title}
        </Text>
        {isPlaying && (
          <View
            style={[styles.progressBar, { backgroundColor: colors.separator }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: colors.brand,
                },
              ]}
            />
          </View>
        )}
      </View>
      {duration && (
        <Text variant="caption" style={{ color: colors.subtle }}>
          {duration}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    padding: 16,
    gap: 16,
  },
  headerMeta: {
    flex: 1,
    gap: 6,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  albumName: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Fonts.bold,
  },
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionButtonText: {
    color: "#fff",
    fontFamily: Fonts.semiBold,
  },
  callout: {
    textAlign: "center",
  },
  trackSection: {
    borderTopWidth: 0,
  },
  trackHeader: {
    fontFamily: Fonts.semiBold,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  playButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    marginLeft: 1,
  },
  trackNumber: {
    width: 26,
    textAlign: "center",
    fontFamily: Fonts.medium,
  },
  trackMeta: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    fontFamily: Fonts.medium,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    marginTop: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 32,
  },
});
