import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  AppSheet,
  AppSheetScrollView,
  type Sheet,
} from "@/components/ui/AppSheet";
import { Text } from "@/components/ui/Text";
import { IS_IOS } from "@/constants/platform";
import { useShazam } from "@/hooks/shazam/use-shazam";
import { Fonts } from "@/constants/theme";
import { ShazamListeningIndicator } from "./ShazamListeningIndicator";
import { ShazamMatchResult, type ReleaseRoute } from "./ShazamMatchResult";
import { useColors } from "@/hooks/use-colors";

type Props = {
  sheet: Sheet;
  /** Navigate to an artist within the host tab's stack. */
  onViewArtist: (mbid: string, name: string) => void;
  /** Navigate to a release page within the host tab's stack. */
  onViewRelease: (params: ReleaseRoute) => void;
  /** Open the search tab prefilled with a query. */
  onSearchManually: (query: string) => void;
};

export function ShazamSheet({ sheet, ...props }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <AppSheet
      sheet={sheet}
      // A result that needs room grows the sheet. Android keeps the height a
      // sheet opened at, so there it stays draggable instead.
      snapPoints={IS_IOS && expanded ? ["full"] : ["half", "full"]}
    >
      <ShazamSession sheet={sheet} onExpand={setExpanded} {...props} />
    </AppSheet>
  );
}

/** Mounts only while the sheet is up, so it listens from each opening. */
function ShazamSession({
  sheet,
  onExpand,
  onViewArtist,
  onViewRelease,
  onSearchManually,
}: Props & { onExpand: (expanded: boolean) => void }) {
  const colors = useColors();
  const shazam = useShazam();
  const { status, start, cancel, reset } = shazam;
  const { close, isPresented } = sheet;

  useEffect(() => {
    start();
  }, [start]);

  // The mic stops as the sheet starts to close, not once it has gone.
  useEffect(() => {
    if (!isPresented) cancel();
  }, [isPresented, cancel]);

  // The next opening starts compact.
  useEffect(() => () => onExpand(false), [onExpand]);

  // Listening again, as after a retry, needs no room.
  useEffect(() => {
    if (status === "listening") onExpand(false);
  }, [status, onExpand]);

  const dismiss = useCallback(() => close(), [close]);

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
    start();
  }, [reset, start]);

  // Each leaves the tab's page, so it waits for the sheet to go.
  const handleViewArtist = useCallback(
    (mbid: string, name: string) => close(() => onViewArtist(mbid, name)),
    [close, onViewArtist],
  );

  const handleViewRelease = useCallback(
    (params: ReleaseRoute) => close(() => onViewRelease(params)),
    [close, onViewRelease],
  );

  const handleSearchManually = useCallback(
    (query: string) => close(() => onSearchManually(query)),
    [close, onSearchManually],
  );

  return (
    <AppSheetScrollView contentContainerStyle={styles.content}>
      {status === "matched" && shazam.match ? (
        <ShazamMatchResult
          match={shazam.match}
          onViewArtist={handleViewArtist}
          onViewRelease={handleViewRelease}
          onSearchManually={handleSearchManually}
          onResolved={onExpand}
        />
      ) : status === "permission_denied" ? (
        <CenteredState
          icon="mic-off-outline"
          title="Microphone access needed"
          body="Aurral needs the microphone to identify the song playing around you."
          primaryLabel="Open Settings"
          onPrimary={() => Linking.openSettings()}
          secondaryLabel="Not now"
          onSecondary={dismiss}
        />
      ) : status === "no_match" ? (
        <CenteredState
          icon="help-circle-outline"
          title="Couldn't recognize the song"
          body="Move closer to the source, lower background noise, and try again."
          primaryLabel="Try again"
          onPrimary={handleRetry}
          secondaryLabel="Done"
          onSecondary={dismiss}
        />
      ) : status === "error" ? (
        <CenteredState
          icon="alert-circle-outline"
          title="Something went wrong"
          body={shazam.errorMessage ?? "Please try again."}
          primaryLabel="Try again"
          onPrimary={handleRetry}
          secondaryLabel="Done"
          onSecondary={dismiss}
        />
      ) : (
        <View style={styles.listening}>
          <ShazamListeningIndicator />
          <Text variant="title" style={styles.listeningTitle}>
            Listening…
          </Text>
          <Text
            variant="caption"
            style={[styles.listeningHint, { color: colors.subtle }]}
          >
            Point your phone toward the music
          </Text>
          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [
              styles.cancelButton,
              { borderColor: colors.separator, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text variant="body" style={{ color: colors.text }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      )}
    </AppSheetScrollView>
  );
}

function CenteredState({
  icon,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.centered}>
      <Ionicons name={icon} size={48} color={colors.subtle} />
      <Text variant="title" style={styles.centeredTitle}>
        {title}
      </Text>
      <Text
        variant="caption"
        style={[styles.centeredBody, { color: colors.subtle }]}
      >
        {body}
      </Text>
      <Pressable
        onPress={onPrimary}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.brand, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text
          variant="body"
          style={[
            styles.primaryButtonText,
            { color: colors.buttonPrimaryText },
          ]}
        >
          {primaryLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={onSecondary}
        style={({ pressed }) => [
          styles.secondaryButton,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text variant="caption" style={{ color: colors.subtle }}>
          {secondaryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  listening: {
    alignItems: "center",
    paddingTop: 16,
    gap: 8,
  },
  listeningTitle: {
    ...Fonts.bold,
    fontSize: 22,
  },
  listeningHint: {
    textAlign: "center",
  },
  cancelButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  centered: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 24,
    gap: 10,
  },
  centeredTitle: {
    ...Fonts.bold,
    fontSize: 20,
    textAlign: "center",
    marginTop: 4,
  },
  centeredBody: {
    textAlign: "center",
  },
  primaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    ...Fonts.semiBold,
  },
  secondaryButton: {
    marginTop: 4,
    paddingVertical: 8,
  },
});
