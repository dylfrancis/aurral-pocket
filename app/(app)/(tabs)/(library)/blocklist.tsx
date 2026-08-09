import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import type { ErrorBoundaryProps } from "expo-router";
import { Text } from "@/components/ui/Text";
import { Chip } from "@/components/ui/Chip";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import {
  AutocompleteInput,
  SuggestionRow,
} from "@/components/blocklist/AutocompleteInput";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import {
  useBlocklistMutations,
  useBlocklistSuspense,
} from "@/hooks/discover/use-blocklist";
import { isArtistBlocked } from "@/lib/blocklist";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { BlockedArtist } from "@/lib/types/discovery-feedback";
import type { SearchArtist } from "@/lib/types/search";

const MAX_SUGGESTIONS = 6;

export default function BlocklistScreen() {
  const colors = Colors[useColorScheme()];
  const { data: blocked } = useBlocklistSuspense();
  const { blockArtist, unblockArtist } = useBlocklistMutations();

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

  const handleSelectArtist = (artist: SearchArtist) => {
    if (isArtistBlocked(blocked, artist)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    blockArtist.mutate({ id: artist.id, name: artist.name });
    setArtistQuery("");
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
    setArtistQuery("");
  };

  const handleUnblock = (entry: BlockedArtist) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    unblockArtist.mutate(entry);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="caption" style={[styles.helper, { color: colors.subtle }]}>
        Blocked artists are not recommended to you and are kept out of your
        playlists and flows.
      </Text>

      <AutocompleteInput
        value={artistQuery}
        onChangeText={setArtistQuery}
        placeholder="Search for an artist"
        suggestions={suggestions}
        isLoading={isFetching}
        keyExtractor={(artist) => artist.id || artist.name}
        isItemDisabled={(artist) => isArtistBlocked(blocked, artist)}
        onSelectSuggestion={handleSelectArtist}
        onSubmit={handleSubmitTypedArtist}
        returnKeyType="done"
        renderSuggestion={(artist) => (
          <SuggestionRow
            primary={artist.name}
            disabled={isArtistBlocked(blocked, artist)}
          />
        )}
      />

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
  sectionTitle: {
    fontFamily: Fonts.semiBold,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
