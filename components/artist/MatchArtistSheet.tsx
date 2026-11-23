import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, StyleSheet, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { AppSheet } from "@/components/ui/AppSheet";
import { Button } from "@/components/ui/Button";
import { inputBaseStyle, inputThemedStyle } from "@/components/ui/Input";
import { MediaRow } from "@/components/ui/MediaRow";
import { Text } from "@/components/ui/Text";
import { SHEET_BOTTOM_PADDING } from "@/constants/navigation";
import { Fonts } from "@/constants/theme";
import {
  useArtistMatches,
  useMatchArtist,
} from "@/hooks/library/use-artist-match";
import { useDebouncedValue } from "@/hooks/search/use-debounced-value";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import type { ArtistMatch, ArtistMatchResult } from "@/lib/types/library";

/** The web's match search delay. */
const SEARCH_DELAY_MS = 300;

const MBID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** An MBID in what was typed, as a pasted MusicBrainz link carries one. */
const pastedMbid = (value: string) =>
  value.match(MBID_PATTERN)?.[0]?.toLowerCase() ?? null;

const nameKey = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

/** The one match named exactly like the artist, which the web picks for you. */
function onlyExactMatch(items: readonly ArtistMatch[], name: string) {
  const exact = items.filter((item) => nameKey(item.name) === nameKey(name));
  return exact.length === 1 ? exact[0].id : null;
}

type Props = {
  libraryArtistId: string;
  artistName: string;
  /** The artist's MBID now, which Remove Match clears. */
  currentMbid?: string;
  onSaved: (result: ArtistMatchResult) => void;
  onDismiss: () => void;
};

/**
 * Picks the MusicBrainz artist a Library artist is, from a search Aurral
 * runs. Mounts only while open, so each visit starts from the artist's name.
 */
export function MatchArtistSheet({
  libraryArtistId,
  artistName,
  currentMbid,
  onSaved,
  onDismiss,
}: Props) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState(artistName);
  const [picked, setPicked] = useState<string | null>(null);
  const search = useDebouncedValue(query.trim(), SEARCH_DELAY_MS);
  const pasted = pastedMbid(query);
  const matches = useArtistMatches(libraryArtistId, search, !pasted);
  const save = useMatchArtist(libraryArtistId);

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
    onDismiss();
  }, [onDismiss]);

  const items = matches.data ?? [];
  const current = currentMbid || null;
  // A pick a new search dropped no longer counts.
  const pickedRow = items.some((item) => item.id === picked) ? picked : null;
  const chosen =
    pasted ?? pickedRow ?? onlyExactMatch(items, artistName) ?? current;

  const submit = (mbid: string | null) => {
    if (save.isPending) return;
    save.mutate(mbid, {
      onSuccess: (result) => {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        sheetRef.current?.dismiss();
        onSaved(result);
      },
      onError: (error) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Burnt.toast({
          title: "Couldn't save the match",
          message: error instanceof Error ? error.message : undefined,
          preset: "error",
        });
      },
    });
  };

  const row = (
    id: string,
    title: string,
    detail: string,
    match?: ArtistMatch,
  ) => (
    <MediaRow
      key={id}
      imageType="artist"
      coverUrl={match?.imageUrl ?? undefined}
      title={title}
      subtitle={detail}
      selected={id === chosen}
      showChevron={false}
      trailing={
        id === chosen ? (
          <Ionicons name="checkmark" size={22} color={colors.brand} />
        ) : null
      }
      onPress={() => setPicked(id)}
    />
  );

  const renderList = () => {
    if (pasted) return row(pasted, "MusicBrainz ID", pasted);
    if (matches.isPending) {
      return <ActivityIndicator style={styles.state} color={colors.subtle} />;
    }
    if (matches.isError) {
      return (
        <View style={styles.state}>
          <Text variant="caption">{"Couldn't load matches"}</Text>
          <Button
            variant="inline"
            title="Try Again"
            onPress={() => void matches.refetch()}
          />
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <Text variant="caption" style={styles.state}>
          No matches
        </Text>
      );
    }
    return items.map((item) =>
      row(
        item.id,
        item.name,
        [
          item.disambiguation,
          item.type,
          item.libraryArtistId != null &&
          String(item.libraryArtistId) !== libraryArtistId
            ? "In your Library"
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        item,
      ),
    );
  };

  return (
    <AppSheet
      ref={sheetRef}
      background="card"
      snapPoints={["85%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={handleDismiss}
    >
      <View style={styles.header}>
        <Text variant="title" style={styles.title}>
          Match Artist
        </Text>
        <Text
          variant="caption"
          numberOfLines={1}
          style={[styles.subtitle, { color: colors.subtle }]}
        >
          {artistName}
        </Text>
        <BottomSheetTextInput
          style={[inputBaseStyle, inputThemedStyle(colorScheme)]}
          placeholder="Search or paste a MusicBrainz link"
          placeholderTextColor={colors.placeholder}
          value={query}
          onChangeText={setQuery}
          editable={!save.isPending}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      <BottomSheetScrollView keyboardShouldPersistTaps="handled">
        {renderList()}
      </BottomSheetScrollView>
      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.separator,
            paddingBottom: SHEET_BOTTOM_PADDING,
          },
        ]}
      >
        <Button
          title="Save"
          loading={save.isPending && save.variables !== null}
          disabled={save.isPending || !chosen || chosen === current}
          onPress={() => submit(chosen)}
        />
        <View style={styles.secondary}>
          {current ? (
            <Button
              variant="inline"
              title="Remove Match"
              disabled={save.isPending}
              onPress={() => submit(null)}
            />
          ) : (
            <View />
          )}
          <Button
            variant="inline"
            title="Cancel"
            disabled={save.isPending}
            onPress={() => sheetRef.current?.dismiss()}
          />
        </View>
      </View>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    marginBottom: 4,
    ...Fonts.semiBold,
  },
  subtitle: {
    marginBottom: 12,
  },
  state: {
    alignItems: "center",
    paddingVertical: 24,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
});
