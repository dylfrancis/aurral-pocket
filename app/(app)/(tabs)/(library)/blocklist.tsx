import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import type { SearchBarCommands } from "react-native-screens";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import { SuggestionRow } from "@/components/blocklist/SuggestionRow";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import {
  useBlocklistMutations,
  useBlocklistSuspense,
} from "@/hooks/discover/use-blocklist";
import { isArtistBlocked } from "@/lib/blocklist";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts, Radius } from "@/constants/theme";
import type { BlockedArtist } from "@/lib/types/discovery-feedback";
import type { SearchArtist } from "@/lib/types/search";

const MAX_SUGGESTIONS = 6;
const MIN_QUERY_LENGTH = 2;

export default function BlocklistScreen() {
  const colors = Colors[useColorScheme()];
  const { data: blocked } = useBlocklistSuspense();
  const { blockArtist, unblockArtist } = useBlocklistMutations();

  // The native search bar owns its text, so clearing after a block has to go
  // through the ref — resetting our state alone leaves the field populated.
  const searchBarRef = useRef<SearchBarCommands>(null);
  const [artistQuery, setArtistQuery] = useState("");
  const { data: artistResults, isFetching } = useArtistSearch(artistQuery);

  const suggestions: SearchArtist[] = useMemo(() => {
    const list = artistResults?.artists ?? [];
    const seen = new Set<string>();
    const out: SearchArtist[] = [];
    for (const artist of list) {
      const name = artist?.name?.trim();
      if (!name) continue;
      const key = (artist.id || name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(artist);
      if (out.length >= MAX_SUGGESTIONS) break;
    }
    return out;
  }, [artistResults]);

  const isSearching = artistQuery.trim().length >= MIN_QUERY_LENGTH;

  const clearQuery = useCallback(() => {
    searchBarRef.current?.clearText();
    setArtistQuery("");
  }, []);

  const handleSelectArtist = (artist: SearchArtist) => {
    if (isArtistBlocked(blocked, artist)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    blockArtist.mutate({ id: artist.id, name: artist.name });
    clearQuery();
  };

  // Blocking a name the search could not resolve is still useful: Aurral
  // matches on name as well as id when filtering recommendations.
  const handleSubmitTypedArtist = () => {
    const name = artistQuery.trim();
    if (!name) return;
    if (suggestions.length > 0) {
      handleSelectArtist(suggestions[0]);
      return;
    }
    if (isArtistBlocked(blocked, { name })) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    blockArtist.mutate({ name });
    clearQuery();
  };

  const handleUnblock = (entry: BlockedArtist) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    unblockArtist.mutate(entry);
  };

  return (
    <>
      <Stack.SearchBar
        ref={searchBarRef}
        placeholder="Search for an artist"
        hideWhenScrolling={false}
        autoCapitalize="none"
        onChangeText={(e) => setArtistQuery(e.nativeEvent.text)}
        onSearchButtonPress={handleSubmitTypedArtist}
        onCancelButtonPress={() => setArtistQuery("")}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          variant="caption"
          style={[styles.helper, { color: colors.subtle }]}
        >
          Blocked artists are not recommended to you and are kept out of your
          playlists and flows.
        </Text>

        {isSearching ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text
                variant="body"
                style={[styles.sectionTitle, { color: colors.text }]}
              >
                Results
              </Text>
              {isFetching ? (
                <ActivityIndicator size="small" color={colors.subtle} />
              ) : null}
            </View>
            {suggestions.length > 0 ? (
              <Card bordered radius={Radius.compact} style={styles.suggestions}>
                {suggestions.map((artist) => {
                  const disabled = isArtistBlocked(blocked, artist);
                  return (
                    <Pressable
                      key={artist.id || artist.name}
                      onPress={() => handleSelectArtist(artist)}
                      disabled={disabled}
                      style={({ pressed }) => [
                        styles.suggestion,
                        pressed &&
                          !disabled && { backgroundColor: colors.brandMuted },
                      ]}
                    >
                      <SuggestionRow
                        primary={artist.name}
                        secondary={disabled ? "Already blocked" : undefined}
                        disabled={disabled}
                      />
                    </Pressable>
                  );
                })}
              </Card>
            ) : isFetching ? null : (
              <Text variant="caption" style={{ color: colors.subtle }}>
                No artists found. Press search to block this name anyway.
              </Text>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text
            variant="body"
            style={[styles.sectionTitle, { color: colors.text }]}
          >
            Blocked Artists
          </Text>
          {blocked.length === 0 ? (
            <EmptyState
              icon="person-remove-outline"
              message="You have not blocked any artists"
            />
          ) : (
            <View style={styles.chips}>
              {blocked.map((entry) => (
                <Chip
                  key={entry.id}
                  label={entry.name}
                  icon="close-circle"
                  variant="subtle"
                  onPress={() => handleUnblock(entry)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ScreenCenter>
      <EmptyState
        icon="cloud-offline-outline"
        message="Failed to load blocklist"
        actionLabel="Try Again"
        onAction={() => {
          reset();
          retry();
        }}
      />
    </ScreenCenter>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 20,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
  },
  suggestions: {
    overflow: "hidden",
  },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
