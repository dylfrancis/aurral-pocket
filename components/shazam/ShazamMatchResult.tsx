import { EmptyState } from "@/components/library/EmptyState";
import { Chip } from "@/components/ui/Chip";
import { Separator } from "@/components/ui/Separator";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useAddArtist } from "@/hooks/search/use-add-artist";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { useIsrcArtist } from "@/hooks/shazam/use-isrc-artist";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { absolutizeImageUrl } from "@/lib/api/client";
import { rankCandidates } from "@/lib/shazam/rank-candidates";
import type { SearchArtist } from "@/lib/types/search";
import type { ShazamMatch } from "@/modules/shazam";
import { Ionicons } from "@expo/vector-icons";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

const CANDIDATE_LIMIT = 5;

type Props = {
  match: ShazamMatch;
  onViewArtist: (mbid: string, name: string) => void;
  onSearchManually: (query: string) => void;
  onResolved?: (needsExpandedSheet: boolean) => void;
};

export function ShazamMatchResult({
  match,
  onViewArtist,
  onSearchManually,
  onResolved,
}: Props) {
  const colors = Colors[useColorScheme()];
  const hasPermission = useHasPermission();
  const canAddArtist = hasPermission("addArtist");
  const { isInLibrary } = useLibraryLookup();

  const artistName = match.artist ?? "";
  const { data, isLoading } = useArtistSearch(artistName);
  const { data: isrcArtist, isLoading: isrcLoading } = useIsrcArtist(
    match.isrc,
  );

  const { candidates, hasBestMatch } = useMemo(
    () =>
      rankCandidates(data?.artists ?? [], isrcArtist ?? null, CANDIDATE_LIMIT),
    [data?.artists, isrcArtist],
  );

  const settled = !isLoading && !isrcLoading;
  const needsExpandedSheet = candidates.length > 1;
  useEffect(() => {
    if (settled) onResolved?.(needsExpandedSheet);
  }, [settled, needsExpandedSheet, onResolved]);

  const addArtist = useAddArtist();

  const handleAdd = useCallback(
    (artist: SearchArtist) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addArtist.mutate(
        {
          foreignArtistId: artist.id,
          artistName: artist.name,
          monitorOption: "all",
        },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Burnt.toast({
              title: `Added ${artist.name}`,
              message: "Now in your library",
              preset: "done",
            });
          },
          onError: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Burnt.toast({
              title: "Couldn't add artist",
              message: "Please try again",
              preset: "error",
            });
          },
        },
      );
    },
    [addArtist],
  );

  return (
    <View>
      <View style={styles.header}>
        {match.artworkUrl ? (
          <Image
            source={{ uri: match.artworkUrl }}
            style={[styles.artwork, { backgroundColor: colors.card }]}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={[
              styles.artwork,
              styles.artworkPlaceholder,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons name="musical-notes" size={28} color={colors.subtle} />
          </View>
        )}
        <View style={styles.headerMeta}>
          <Text variant="caption" style={{ color: colors.brand }}>
            Identified
          </Text>
          <Text variant="title" numberOfLines={2} style={styles.songTitle}>
            {match.title}
          </Text>
          {match.artist && (
            <Text
              variant="caption"
              numberOfLines={1}
              style={{ color: colors.subtle }}
            >
              {match.artist}
            </Text>
          )}
        </View>
      </View>

      <Separator style={styles.divider} />

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand} />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon="person-outline"
          message={`Couldn't find ${artistName || "this artist"} in your Aurral library`}
          actionLabel="Search manually"
          onAction={() => onSearchManually(artistName)}
        />
      ) : (
        <View>
          <Text
            variant="caption"
            style={[styles.sectionLabel, { color: colors.subtle }]}
          >
            Add the artist
          </Text>
          <Text
            variant="caption"
            style={[styles.sectionCaption, { color: colors.subtle }]}
          >
            {hasBestMatch
              ? `Identified from the recording. Tap to view, or Add to your library.`
              : `Top matches for “${artistName}” — tap a row to view, or Add to your library.`}
          </Text>
          {candidates.map((artist) => (
            <ArtistCandidateRow
              key={artist.id}
              artist={artist}
              inLibrary={isInLibrary(artist.id)}
              canAdd={canAddArtist}
              isAdding={
                addArtist.isPending &&
                addArtist.variables?.foreignArtistId === artist.id
              }
              wasAdded={
                addArtist.isSuccess &&
                addArtist.variables?.foreignArtistId === artist.id
              }
              onAdd={() => handleAdd(artist)}
              onView={() => onViewArtist(artist.id, artist.name)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ArtistCandidateRow({
  artist,
  inLibrary,
  canAdd,
  isAdding,
  wasAdded,
  onAdd,
  onView,
}: {
  artist: SearchArtist;
  inLibrary: boolean;
  canAdd: boolean;
  isAdding: boolean;
  wasAdded: boolean;
  onAdd: () => void;
  onView: () => void;
}) {
  const colors = Colors[useColorScheme()];
  const added = inLibrary || wasAdded;
  const imageUrl = absolutizeImageUrl(artist.image ?? artist.imageUrl);

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      <Pressable
        style={({ pressed }) => [
          styles.rowMain,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={onView}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.rowThumb, { backgroundColor: colors.card }]}
            contentFit="cover"
            transition={150}
            recyclingKey={`shazam-${artist.id}`}
          />
        ) : (
          <View
            style={[
              styles.rowThumb,
              styles.rowThumbPlaceholder,
              { backgroundColor: colors.card },
            ]}
          >
            <Ionicons name="person-outline" size={18} color={colors.subtle} />
          </View>
        )}
        <Text variant="body" numberOfLines={1} style={styles.rowName}>
          {artist.name}
        </Text>
      </Pressable>

      {added ? (
        <Chip label="In Library" variant="brand" />
      ) : canAdd ? (
        <Pressable
          onPress={onAdd}
          disabled={isAdding}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {isAdding ? (
            <ActivityIndicator size={14} color="#fff" />
          ) : (
            <>
              <Ionicons name="add" size={16} color="#fff" />
              <Text variant="caption" style={styles.addButtonText}>
                Add
              </Text>
            </>
          )}
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  artwork: {
    width: 96,
    height: 96,
    borderRadius: 10,
  },
  artworkPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerMeta: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  songTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Fonts.bold,
  },
  divider: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  sectionCaption: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    lineHeight: 18,
  },
  loader: {
    paddingVertical: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  rowThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: {
    flex: 1,
    fontFamily: Fonts.medium,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#fff",
    fontFamily: Fonts.semiBold,
  },
});
