import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetView, type BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";

import { ScrollHeaderTitle } from "@/components/artist/ArtistDetailLayout";
import {
  AddToPlaylistSheet,
  useAddToPlaylist,
} from "@/components/flow/AddToPlaylistSheet";
import { AlbumSearchStatusBadge } from "@/components/search/AlbumSearchStatusBadge";
import { AppSheet } from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "./CoverArtImage";
import { useAudioPreview } from "@/hooks/library/use-audio-preview";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  addLibraryAlbum,
  getReleaseGroupTracks,
  requestAlbumFromSearch,
  searchDeezerAlbum,
  triggerAlbumSearch,
  type ReleaseGroupTrack,
} from "@/lib/api/library";
import { ApiError } from "@/lib/api/client";
import { libraryAlbumsRef } from "@/lib/library-read";
import { libraryKeys } from "@/lib/query-keys";
import { Colors, Fonts } from "@/constants/theme";
import { IS_IOS } from "@/constants/platform";
import type { AlbumStatus } from "@/lib/types/search";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COVER_SIZE = Math.min(SCREEN_WIDTH - 120, 260);

const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "searching",
  "downloading",
  "processing",
]);

type ReleaseRouteParams = {
  mbid: string;
  title?: string;
  artistName?: string;
  artistMbid?: string;
  artistId?: string;
  primaryType?: string;
  secondaryTypes?: string;
  releaseDate?: string;
  status?: string;
  libraryAlbumId?: string;
};

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

/**
 * The page for an album that is not in the library, reached as
 * `/release/[mbid]` from search results and from an artist's release groups.
 *
 * It replaces two bottom sheets that had grown into near-copies of each
 * other — the same Deezer-backed track read, the same preview player, the
 * same row, and two spellings of the same header. They differed only in
 * their action button, so this keeps the richer of the two: an artist-page
 * release group is simply the case with no library status yet.
 *
 * Its tracks are preview clips, not library files. There is nothing to
 * queue, so the row offers a clip to audition and a playlist to save it to,
 * and nothing that implies real playback.
 */
export function ReleaseDetailScreen() {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const heroPaddingTop = (IS_IOS ? headerHeight : 0) + 24;
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<ReleaseRouteParams>();

  const hasPermission = useHasPermission();
  const canAddAlbum = hasPermission("addAlbum");
  const { libraryArtists } = useLibraryLookup();
  const { canAddToPlaylist, ...addToPlaylist } = useAddToPlaylist();

  const mbid = params.mbid;
  const title = params.title ?? "";
  const artistName = params.artistName ?? "";
  const status = params.status || "missing";
  const libraryAlbumId = params.libraryAlbumId || "";

  // Search knows the artist only by MBID, so the Lidarr id it needs to add an
  // album is resolved here. An artist page passes its own and skips the walk.
  const libraryArtistId =
    params.artistId ||
    (params.artistMbid
      ? (libraryArtists?.find((a) => a.mbid === params.artistMbid)?.id ?? null)
      : null);

  const { data: tracks, isLoading: tracksLoading } = useQuery({
    queryKey: libraryKeys.releaseGroupTracks(mbid),
    queryFn: async () => {
      const deezerId = await searchDeezerAlbum(artistName, title);
      return getReleaseGroupTracks(mbid, {
        deezerAlbumId: deezerId ?? undefined,
        artistMbid: params.artistMbid || undefined,
        artistName,
        albumTitle: title,
        releaseType: params.primaryType || undefined,
        releaseDate: params.releaseDate || undefined,
      });
    },
    enabled: !!mbid,
    staleTime: 10 * 60 * 1000,
  });

  const {
    playingId,
    loadingId,
    progress,
    toggle: toggleAudio,
    stop: stopPreview,
  } = useAudioPreview();

  // Leaving the page must not leave a clip playing behind it.
  useEffect(() => () => stopPreview(), [stopPreview]);

  const togglePreview = useCallback(
    (track: ReleaseGroupTrack) => {
      if (!track.preview_url) return;
      toggleAudio(trackKey(track), track.preview_url);
    },
    [toggleAudio],
  );

  const invalidateAfterMutation = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: libraryKeys.artists() });
    void queryClient.invalidateQueries({ queryKey: ["search", "albums"] });
    void queryClient.invalidateQueries({
      queryKey: libraryKeys.downloadStatusesAll(),
    });
    if (libraryArtistId) {
      const artistRef = libraryAlbumsRef({
        artistId: libraryArtistId,
        artistMbid: params.artistMbid,
      });
      if (artistRef) {
        void queryClient.invalidateQueries({
          queryKey: libraryKeys.albums(artistRef),
        });
      }
    }
  }, [queryClient, libraryArtistId, params.artistMbid]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (libraryArtistId) {
        await addLibraryAlbum(libraryArtistId, mbid, title);
        return { createdArtist: false };
      }
      if (!params.artistMbid) {
        throw new Error("Cannot add album without an artist reference");
      }
      const r = await requestAlbumFromSearch({
        albumMbid: mbid,
        albumName: title,
        artistMbid: params.artistMbid,
        artistName,
      });
      return { createdArtist: !!r.createdArtist };
    },
    onSuccess: ({ createdArtist }) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidateAfterMutation();
      Burnt.toast({
        title: createdArtist ? `Added ${artistName}` : "Added to library",
        message: createdArtist ? "Now in your library" : title,
        preset: "done",
      });
    },
    onError: (error) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Burnt.toast({
        title: "Couldn't add album",
        message: describeError(error),
        preset: "error",
      });
    },
  });

  const researchMutation = useMutation({
    mutationFn: () => triggerAlbumSearch(libraryAlbumId),
    onSuccess: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      invalidateAfterMutation();
      Burnt.toast({ title: "Searching for this album", preset: "done" });
    },
    onError: (error) => {
      Burnt.toast({
        title: "Couldn't trigger search",
        message: describeError(error),
        preset: "error",
      });
    },
  });

  const action = resolveAction({
    status,
    libraryAlbumId,
    canAddAlbum,
    added: addMutation.isSuccess,
    isPending: addMutation.isPending || researchMutation.isPending,
  });

  const onActionPress = () => {
    if (action.kind === "add") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addMutation.mutate();
    } else if (action.kind === "research") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      researchMutation.mutate();
    }
  };

  const openArtist = useCallback(() => {
    if (!params.artistMbid) return;
    router.push({
      pathname: "/artist/[mbid]",
      params: { mbid: params.artistMbid, name: artistName },
    });
  }, [router, params.artistMbid, artistName]);

  const trackActionsRef = useRef<BottomSheetModal>(null);
  const [actionTrack, setActionTrack] = useState<ReleaseGroupTrack | null>(
    null,
  );
  const openTrackActions = useCallback((track: ReleaseGroupTrack) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionTrack(track);
    trackActionsRef.current?.present();
  }, []);

  const year = params.releaseDate
    ? new Date(params.releaseDate).getFullYear()
    : null;
  const secondaryTypes = (params.secondaryTypes || "")
    .split(",")
    .filter(Boolean);
  const primaryType = params.primaryType || "Album";
  const typeLabel =
    secondaryTypes.length > 0
      ? `${primaryType} · ${secondaryTypes.join(", ")}`
      : primaryType;
  const trackCount = tracks?.length ?? 0;

  const actionForeground = action.disabled
    ? colors.subtle
    : colors.buttonPrimaryText;

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <ScrollHeaderTitle name={title} scrollY={scrollY} />
          ),
        }}
      />
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={[styles.hero, { paddingTop: heroPaddingTop }]}>
          <CoverArtImage
            type="album"
            mbid={mbid}
            size={COVER_SIZE}
            borderRadius={12}
          />
          <Text variant="title" style={styles.albumName}>
            {title}
          </Text>
          <Pressable
            onPress={openArtist}
            disabled={!params.artistMbid}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text
              variant="body"
              style={[
                styles.artistName,
                { color: params.artistMbid ? colors.brand : colors.subtle },
              ]}
            >
              {artistName}
            </Text>
          </Pressable>
          <Text variant="caption" style={{ color: colors.subtle }}>
            {[
              year,
              typeLabel,
              trackCount
                ? `${trackCount} track${trackCount === 1 ? "" : "s"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {params.status ? (
            <AlbumSearchStatusBadge status={params.status as AlbumStatus} />
          ) : null}
        </View>

        <View style={styles.actionWrap}>
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
              <ActivityIndicator size={18} color={actionForeground} />
            ) : (
              <Ionicons name={action.icon} size={18} color={actionForeground} />
            )}
            <Text
              variant="body"
              style={[styles.actionLabel, { color: actionForeground }]}
            >
              {action.label}
            </Text>
          </Pressable>
          {action.kind === "add" && !libraryArtistId && !!params.artistMbid && (
            <Text
              variant="caption"
              style={[styles.callout, { color: colors.subtle }]}
            >
              This will also add {artistName} to your library.
            </Text>
          )}
        </View>

        {tracksLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.brand} />
        ) : tracks && tracks.length > 0 ? (
          tracks.map((track, i) => {
            const key = trackKey(track);
            const isPlaying = playingId === key;
            return (
              <PreviewTrackRow
                key={`${track.number}-${i}`}
                track={track}
                hasPreview={!!track.preview_url}
                isPlaying={isPlaying}
                isLoading={loadingId === key}
                progress={isPlaying ? progress : 0}
                onToggle={() => togglePreview(track)}
                onMenuPress={
                  canAddToPlaylist ? () => openTrackActions(track) : undefined
                }
              />
            );
          })
        ) : (
          <Text variant="caption" style={styles.emptyText}>
            No tracks available
          </Text>
        )}
      </Animated.ScrollView>

      <AppSheet
        ref={trackActionsRef}
        enableDynamicSizing
        enablePanDownToClose
        onDismiss={() => setActionTrack(null)}
      >
        <BottomSheetView
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <Text variant="subtitle" numberOfLines={1} style={styles.sheetTitle}>
            {actionTrack?.title}
          </Text>
          <Pressable
            onPress={() => {
              const track = actionTrack;
              trackActionsRef.current?.dismiss();
              if (!track) return;
              addToPlaylist.open({
                artistName,
                trackName: track.title,
                albumName: title,
                artistMbid: params.artistMbid || null,
              });
            }}
            style={({ pressed }) => [
              styles.sheetRow,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.text} />
            <Text variant="body">Add to Playlist</Text>
          </Pressable>
        </BottomSheetView>
      </AppSheet>

      <AddToPlaylistSheet
        track={addToPlaylist.track}
        onClose={addToPlaylist.close}
      />
    </View>
  );
}

/** Deezer rows carry no stable id of their own, so this is the fallback chain. */
function trackKey(track: ReleaseGroupTrack) {
  return track.id ?? track.mbid ?? `${track.number}`;
}

type ActionState = {
  kind: "add" | "research" | "none";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  busy: boolean;
};

/**
 * What the one big button does. An artist-page release group arrives with no
 * status, which reads as "missing" — the addable case.
 */
function resolveAction({
  status,
  libraryAlbumId,
  canAddAlbum,
  added,
  isPending,
}: {
  status: string;
  libraryAlbumId: string;
  canAddAlbum: boolean;
  added: boolean;
  isPending: boolean;
}): ActionState {
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
  // The page stays open after an add, so the button has to report the result
  // itself — the sheet it replaced could just close.
  if (added) {
    return {
      kind: "none",
      label: "Added",
      icon: "checkmark",
      disabled: true,
      busy: false,
    };
  }
  if (ACTIVE_STATUSES.has(status)) {
    return {
      kind: "none",
      label: "Searching…",
      icon: "sync-outline",
      disabled: true,
      busy: true,
    };
  }
  if (status === "available") {
    return {
      kind: "none",
      label: "In Library",
      icon: "checkmark",
      disabled: true,
      busy: false,
    };
  }
  if (status === "inLibrary" && libraryAlbumId) {
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

const PreviewTrackRow = React.memo(function PreviewTrackRow({
  track,
  hasPreview,
  isPlaying,
  isLoading,
  progress,
  onToggle,
  onMenuPress,
}: {
  track: ReleaseGroupTrack;
  hasPreview: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  onToggle: () => void;
  onMenuPress?: () => void;
}) {
  const colors = Colors[useColorScheme()];
  const duration = formatDuration(track.length);

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      {hasPreview ? (
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${isPlaying ? "Pause" : "Preview"} ${track.title}`}
          style={({ pressed }) => [
            styles.playButton,
            {
              backgroundColor: isPlaying ? colors.brand : colors.separator,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={12}
              color={isPlaying ? colors.buttonPrimaryText : colors.text}
              style={isPlaying ? undefined : styles.playIcon}
            />
          )}
        </Pressable>
      ) : (
        <View style={styles.playButtonPlaceholder} />
      )}
      <View style={styles.trackMeta}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.trackTitle, isPlaying && { color: colors.brand }]}
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
                { width: `${progress * 100}%`, backgroundColor: colors.brand },
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
      {onMenuPress && (
        <Pressable
          onPress={onMenuPress}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${track.title}`}
          style={({ pressed }) => [
            styles.menuButton,
            { opacity: pressed ? 0.5 : 1 },
          ]}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={colors.subtle}
          />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  albumName: {
    textAlign: "center",
    marginTop: 8,
  },
  artistName: {
    textAlign: "center",
    ...Fonts.medium,
  },
  actionWrap: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
  },
  actionLabel: {
    ...Fonts.semiBold,
  },
  callout: {
    textAlign: "center",
  },
  row: {
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
  playButtonPlaceholder: {
    width: 26,
  },
  playIcon: {
    marginLeft: 1,
  },
  trackMeta: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    ...Fonts.medium,
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
  menuButton: {
    paddingLeft: 4,
  },
  loader: {
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 32,
  },
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 4,
  },
  sheetTitle: {
    paddingBottom: 8,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
});
