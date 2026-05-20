import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import { BlockedChip } from "@/components/blocklist/BlockedChip";
import {
  AutocompleteInput,
  BlockedPill,
  SuggestionRow,
} from "@/components/blocklist/AutocompleteInput";
import { useArtistSearch } from "@/hooks/search/use-artist-search";
import { useTagSuggestions } from "@/hooks/search/use-tag-suggestions";
import {
  useBlocklist,
  useBlocklistMutations,
} from "@/hooks/discover/use-blocklist";
import { isArtistBlocked, isValidMbid } from "@/lib/blocklist";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";
import type { BlockedArtist } from "@/lib/types/discover";
import type { SearchArtist } from "@/lib/types/search";

export function BlocklistManager() {
  const colors = Colors[useColorScheme()];
  const { data: blocklist, isLoading, error, refetch } = useBlocklist();
  const { toggleArtist, removeArtist, addTag, removeTag } =
    useBlocklistMutations();

  const [artistQuery, setArtistQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");

  const { data: artistResults, isFetching: artistFetching } =
    useArtistSearch(artistQuery);
  const { data: tagResults, isFetching: tagFetching } =
    useTagSuggestions(tagQuery);

  const artistSuggestions: SearchArtist[] = useMemo(() => {
    const list = artistResults?.artists ?? [];
    const seen = new Set<string>();
    const out: SearchArtist[] = [];
    for (const a of list) {
      if (!a?.id || !a?.name) continue;
      const key = a.id.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a);
    }
    return out.slice(0, 6);
  }, [artistResults]);

  const tagSuggestions: string[] = useMemo(() => {
    const list = tagResults ?? [];
    const blocked = new Set(blocklist?.tags ?? []);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of list) {
      const t = String(raw || "")
        .trim()
        .toLowerCase();
      if (!t || seen.has(t) || blocked.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out.slice(0, 8);
  }, [tagResults, blocklist?.tags]);

  const handleSelectArtist = (artist: SearchArtist) => {
    if (isArtistBlocked(artist.id, artist.name, blocklist)) return;
    const payload: BlockedArtist = {
      mbid: isValidMbid(artist.id) ? artist.id : null,
      name: artist.name,
    };
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleArtist(payload);
    setArtistQuery("");
    Burnt.toast({ title: `Blocked ${artist.name}`, preset: "done" });
  };

  const handleRemoveArtist = (artist: BlockedArtist) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeArtist(artist);
    Burnt.toast({
      title: `Unblocked ${artist.name ?? artist.mbid ?? "artist"}`,
      preset: "done",
    });
  };

  const handleSelectTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addTag(normalized);
    setTagQuery("");
    Burnt.toast({ title: `Blocked #${normalized}`, preset: "done" });
  };

  const handleSubmitTag = () => {
    const trimmed = tagQuery.trim().toLowerCase();
    if (trimmed.length < 1) return;
    if (blocklist?.tags.includes(trimmed)) {
      setTagQuery("");
      return;
    }
    handleSelectTag(trimmed);
  };

  const handleRemoveTag = (tag: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeTag(tag);
    Burnt.toast({ title: `Unblocked #${tag}`, preset: "done" });
  };

  if (isLoading) return <ScreenCenter loading />;

  if (error) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="cloud-offline-outline"
          message="Failed to load blocklist"
          actionLabel="Try Again"
          onAction={() => refetch()}
        />
      </ScreenCenter>
    );
  }

  const artists = blocklist?.artists ?? [];
  const tags = blocklist?.tags ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text variant="caption" style={[styles.intro, { color: colors.subtle }]}>
        Blocked artists and tags are hidden from Discover, Flow, and nearby
        shows.
      </Text>

      <View style={styles.section}>
        <SectionHeading
          title="Artists"
          count={artists.length}
          color={colors.subtle}
        />
        <AutocompleteInput<SearchArtist>
          value={artistQuery}
          onChangeText={setArtistQuery}
          placeholder="Search artists…"
          suggestions={artistSuggestions}
          isLoading={artistFetching && artistQuery.trim().length >= 2}
          keyExtractor={(item) => item.id}
          isItemDisabled={(item) =>
            isArtistBlocked(item.id, item.name, blocklist)
          }
          onSelectSuggestion={handleSelectArtist}
          renderSuggestion={(item) => {
            const blocked = isArtistBlocked(item.id, item.name, blocklist);
            return (
              <SuggestionRow
                primary={item.name}
                disabled={blocked}
                trailing={blocked ? <BlockedPill /> : undefined}
              />
            );
          }}
        />

        {artists.length === 0 ? (
          <Text
            variant="caption"
            style={[styles.empty, { color: colors.subtle }]}
          >
            No blocked artists. Tap the block icon in any artist&apos;s header
            to add one.
          </Text>
        ) : (
          <View style={styles.chips}>
            {artists.map((artist) => (
              <BlockedChip
                key={
                  artist.mbid
                    ? `mbid:${artist.mbid.toLowerCase()}`
                    : `name:${(artist.name ?? "").toLowerCase()}`
                }
                label={artist.name || artist.mbid || "Unknown"}
                onRemove={() => handleRemoveArtist(artist)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeading
          title="Genres & Tags"
          count={tags.length}
          color={colors.subtle}
        />
        <AutocompleteInput<string>
          value={tagQuery}
          onChangeText={setTagQuery}
          placeholder="Search tags…"
          suggestions={tagSuggestions}
          isLoading={tagFetching && tagQuery.trim().length >= 2}
          keyExtractor={(item) => item}
          onSelectSuggestion={handleSelectTag}
          onSubmit={handleSubmitTag}
          returnKeyType="done"
          renderSuggestion={(item) => <SuggestionRow primary={`#${item}`} />}
        />

        {tags.length === 0 ? (
          <Text
            variant="caption"
            style={[styles.empty, { color: colors.subtle }]}
          >
            No blocked tags. Search above to add genres or tags.
          </Text>
        ) : (
          <View style={styles.chips}>
            {tags.map((tag) => (
              <BlockedChip
                key={tag}
                label={`#${tag}`}
                onRemove={() => handleRemoveTag(tag)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SectionHeading({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: string;
}) {
  return (
    <Text
      variant="caption"
      style={[styles.heading, { color, fontFamily: Fonts.semiBold }]}
    >
      {title.toUpperCase()} ({count})
    </Text>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 24,
  },
  intro: {
    marginBottom: 4,
  },
  section: {
    gap: 12,
  },
  heading: {
    fontSize: 12,
    letterSpacing: 0.8,
  },
  empty: {
    paddingVertical: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
